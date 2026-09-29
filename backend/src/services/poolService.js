const prisma = require("../config/db");
const { calculateFare } = require("./fareService");
const { isPoolCompatible } = require("../utils/zones");
const { assertValidTransition } = require("./rideStateMachine");

/**
 * Concurrency problem (Section 12): Bullet has 1 seat left; Nusrat and Shirin both
 * try to claim it in the same instant, and both read "1 seat available" before either
 * writes. A naive read-then-write ("if pool.seatsOccupied + seats <= capacity, then
 * update") has a race window between the read and the write.
 *
 * Fix used here: a single atomic SQL UPDATE that both checks and reserves the seats
 * in one statement — `UPDATE ... SET seatsOccupied = seatsOccupied + $seats WHERE id = $pool
 * AND seatsOccupied + $seats <= capacity`. Postgres row-level locking makes this
 * check-and-increment atomic: only one of two concurrent requests can match the WHERE
 * clause and update a row; the loser's statement affects 0 rows, which we treat as
 * "pool full" and fall back to matching (or creating) a different pool.
 * At larger scale we'd move this into a SELECT ... FOR UPDATE transaction or a
 * dedicated seat-reservation queue (see README "AI Usage"/bonus section) — for this
 * MVP's throughput, the atomic UPDATE is simple, provably correct, and needs no extra
 * infrastructure.
 */
async function reserveSeatsAtomically(poolId, seats, capacity) {
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "Pool"
     SET "seatsOccupied" = "seatsOccupied" + $1, "version" = "version" + 1
     WHERE id = $2 AND "seatsOccupied" + $1 <= $3 AND status IN ('REQUESTED','MATCHED')
     RETURNING id`,
    seats,
    poolId,
    capacity,
  );
  return rows.length === 1;
}

/**
 * Find an existing open pool (status REQUESTED/MATCHED, same Tesla, same pickup zone,
 * compatible destination) with enough free seats. Simple O(open pools) scan — fine at
 * MVP scale, and easy to reason about/test.
 */
async function findCompatibleOpenPool(rideRequest) {
  const openPools = await prisma.pool.findMany({
    where: { status: { in: ["REQUESTED", "MATCHED"] } },
    include: { tesla: true, members: { include: { rideRequest: true } } },
  });

  for (const pool of openPools) {
    const freeSeats = pool.tesla.capacity - pool.seatsOccupied;
    if (freeSeats < rideRequest.seats) continue;
    if (pool.matchZone !== rideRequest.pickupZone) continue;
    const compatibleWithAll = pool.members.every((m) =>
      isPoolCompatible(rideRequest, m.rideRequest),
    );
    if (compatibleWithAll) return pool;
  }
  return null;
}

async function findAvailableTesla(excludeTeslaIds = []) {
  return prisma.tesla.findFirst({
    where: { isOnline: true, id: { notIn: excludeTeslaIds } },
  });
}

/**
 * Core matching entry point, called right after a RideRequest is created.
 * 1. Try to join a compatible, non-full open pool (atomic seat reservation).
 * 2. Otherwise open a brand new pool on any online Tesla with free capacity.
 * Both branches recompute every member's fare so pooled passengers get the
 * pool discount as soon as a second rider joins.
 */
async function matchRideRequest(rideRequest) {
  const failedPoolIds = [];

  // Try existing pools first, retrying on lost races (another request grabbed the seat).
  for (let attempt = 0; attempt < 5; attempt++) {
    const pool = await findCompatibleOpenPool({
      ...rideRequest,
      // re-check zone excludes pools we've already failed to reserve into
    });
    if (!pool || failedPoolIds.includes(pool.id)) break;

    const reserved = await reserveSeatsAtomically(
      pool.id,
      rideRequest.seats,
      pool.tesla.capacity,
    );
    if (reserved) {
      return attachToPool(pool.id, rideRequest);
    }
    failedPoolIds.push(pool.id);
  }

  // No compatible pool (or all lost the race) -> open a new pool on a free Tesla.
  const tesla = await findAvailableTesla();
  if (!tesla) {
    const err = new Error("No online Tesla available right now");
    err.status = 503;
    throw err;
  }

  const pool = await prisma.pool.create({
    data: {
      teslaId: tesla.id,
      matchZone: rideRequest.pickupZone,
      status: "REQUESTED",
    },
  });

  const reserved = await reserveSeatsAtomically(
    pool.id,
    rideRequest.seats,
    tesla.capacity,
  );
  if (!reserved) {
    // Should not happen for a freshly created pool, but fail safe.
    const err = new Error("Failed to reserve seats on newly created pool");
    err.status = 500;
    throw err;
  }

  return attachToPool(pool.id, rideRequest);
}

async function attachToPool(poolId, rideRequest) {
  return prisma.$transaction(async (tx) => {
    const pool = await tx.pool.findUnique({
      where: { id: poolId },
      include: { members: { include: { rideRequest: true } }, tesla: true },
    });

    const isPooled = pool.members.length >= 1; // at least one other passenger already aboard
    const { farePoysha } = calculateFare({
      pickupZone: rideRequest.pickupZone,
      destZone: rideRequest.destZone,
      isPooled,
    });

    const membership = await tx.poolMembership.create({
      data: {
        poolId,
        rideRequestId: rideRequest.id,
        passengerId: rideRequest.passengerId,
        seats: rideRequest.seats,
        fareInPoysha: farePoysha,
      },
    });

    await tx.rideRequest.update({
      where: { id: rideRequest.id },
      data: { status: pool.status, estimatedFare: farePoysha },
    });

    // Recompute the pool discount for pre-existing members too, now that pooling is real.
    if (isPooled) {
      for (const m of pool.members) {
        const recalced = calculateFare({
          pickupZone: m.rideRequest.pickupZone,
          destZone: m.rideRequest.destZone,
          isPooled: true,
        });
        await tx.poolMembership.update({
          where: { id: m.id },
          data: { fareInPoysha: recalced.farePoysha },
        });
        await tx.rideRequest.update({
          where: { id: m.rideRequestId },
          data: { estimatedFare: recalced.farePoysha },
        });
      }
    }

    await tx.rideEvent.create({
      data: {
        poolId,
        event: "REQUEST_JOINED",
        actorId: rideRequest.passengerId,
        payload: { rideRequestId: rideRequest.id, fareInPoysha: farePoysha },
      },
    });

    return tx.pool.findUnique({
      where: { id: poolId },
      include: {
        members: { include: { rideRequest: true, passenger: true } },
        tesla: true,
      },
    });
  });
}

async function transitionPoolStatus(poolId, driverId, toStatus) {
  return prisma.$transaction(async (tx) => {
    const pool = await tx.pool.findUnique({
      where: { id: poolId },
      include: { tesla: true },
    });
    if (!pool) {
      const err = new Error("Pool not found");
      err.status = 404;
      throw err;
    }
    if (pool.tesla.driverId !== driverId) {
      const err = new Error("Not your Tesla");
      err.status = 403;
      throw err;
    }
    assertValidTransition(pool.status, toStatus);

    const timestampField = {
      MATCHED: "matchedAt",
      DRIVER_ARRIVED: "arrivedAt",
      STARTED: "startedAt",
      COMPLETED: "completedAt",
      CANCELLED: "cancelledAt",
    }[toStatus];

    const updated = await tx.pool.update({
      where: { id: poolId },
      data: {
        status: toStatus,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
      },
    });

    await tx.rideRequest.updateMany({
      where: { membership: { poolId } },
      data: { status: toStatus },
    });

    await tx.rideEvent.create({
      data: { poolId, event: `STATUS_CHANGED:${toStatus}`, actorId: driverId },
    });

    return updated;
  });
}

async function cancelRideRequest(rideRequestId, passengerId) {
  return prisma.$transaction(async (tx) => {
    const rr = await tx.rideRequest.findUnique({
      where: { id: rideRequestId },
      include: { membership: { include: { pool: true } } },
    });
    if (!rr) {
      const err = new Error("Ride request not found");
      err.status = 404;
      throw err;
    }
    if (rr.passengerId !== passengerId) {
      const err = new Error("You can only cancel your own ride");
      err.status = 403;
      throw err;
    }
    assertValidTransition(rr.status, "CANCELLED");

    await tx.rideRequest.update({
      where: { id: rideRequestId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    if (rr.membership) {
      const seats = rr.membership.seats;
      await tx.pool.update({
        where: { id: rr.membership.poolId },
        data: { seatsOccupied: { decrement: seats } },
      });
      await tx.rideEvent.create({
        data: {
          poolId: rr.membership.poolId,
          event: "PASSENGER_CANCELLED",
          actorId: passengerId,
          payload: { rideRequestId },
        },
      });
    }

    return rr;
  });
}

module.exports = {
  matchRideRequest,
  transitionPoolStatus,
  cancelRideRequest,
  reserveSeatsAtomically,
};
