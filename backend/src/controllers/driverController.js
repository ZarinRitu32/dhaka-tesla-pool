const { z } = require("zod");
const prisma = require("../config/db");
const { transitionPoolStatus } = require("../services/poolService");

async function myTeslas(req, res) {
  const teslas = await prisma.tesla.findMany({
    where: { driverId: req.user.sub },
  });
  res.json(teslas);
}

const createTeslaSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().min(1).max(6),
});

async function createTesla(req, res) {
  const body = createTeslaSchema.parse(req.body);
  const tesla = await prisma.tesla.create({
    data: {
      driverId: req.user.sub,
      name: body.name,
      capacity: body.capacity,
      isOnline: false,
    },
  });
  res.status(201).json(tesla);
}

const onlineSchema = z.object({ isOnline: z.boolean() });

async function setTeslaOnline(req, res) {
  const body = onlineSchema.parse(req.body);
  const tesla = await prisma.tesla.findUnique({
    where: { id: req.params.teslaId },
  });
  if (!tesla) return res.status(404).json({ error: "Tesla not found" });
  if (tesla.driverId !== req.user.sub)
    return res.status(403).json({ error: "Not your Tesla" });

  const updated = await prisma.tesla.update({
    where: { id: tesla.id },
    data: { isOnline: body.isOnline },
  });
  res.json(updated);
}

// Driver sees every passenger/seat assigned to pools on their own Teslas, and
// the ride history for those pools — never another driver's data.
async function myPools(req, res) {
  const pools = await prisma.pool.findMany({
    where: { tesla: { driverId: req.user.sub } },
    orderBy: { createdAt: "desc" },
    include: {
      tesla: true,
      members: {
        where: { rideRequest: { status: { not: "CANCELLED" } } },
        include: { passenger: true, rideRequest: true },
      },
    },
  });
  res.json(pools.map(serializePoolForDriver));
}

const transitionSchema = z.object({
  status: z.enum([
    "MATCHED",
    "DRIVER_ARRIVED",
    "STARTED",
    "COMPLETED",
    "CANCELLED",
  ]),
});

async function transitionPool(req, res) {
  const body = transitionSchema.parse(req.body);
  const pool = await transitionPoolStatus(
    req.params.poolId,
    req.user.sub,
    body.status,
  );
  res.json({ id: pool.id, status: pool.status });
}

function serializePoolForDriver(pool) {
  return {
    id: pool.id,
    teslaName: pool.tesla.name,
    capacity: pool.tesla.capacity,
    seatsOccupied: pool.seatsOccupied,
    status: pool.status,
    matchZone: pool.matchZone,
    passengers: pool.members.map((m) => ({
      name: m.passenger.name,
      pickupZone: m.rideRequest.pickupZone,
      destZone: m.rideRequest.destZone,
      seats: m.seats,
      fareInPoysha: m.fareInPoysha,
    })),
    createdAt: pool.createdAt,
  };
}

module.exports = {
  myTeslas,
  createTesla,
  setTeslaOnline,
  myPools,
  transitionPool,
};
