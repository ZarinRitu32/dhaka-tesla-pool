const { z } = require("zod");
const prisma = require("../config/db");
const { calculateFare } = require("../services/fareService");
const {
  matchRideRequest,
  cancelRideRequest,
} = require("../services/poolService");
const { isKnownZone, ZONES } = require("../utils/zones");

const requestSchema = z.object({
  pickupZone: z.string().refine(isKnownZone, "Unknown pickup zone"),
  destZone: z.string().refine(isKnownZone, "Unknown destination zone"),
  seats: z.number().int().min(1).max(3),
});

async function listZones(req, res) {
  res.json(Object.keys(ZONES));
}

/**
 * POST /rides
 * Creates a RideRequest, computes an initial (unpooled) fare estimate, then
 * immediately tries to match it into a compatible pool or a fresh one.
 */
async function createRide(req, res) {
  const body = requestSchema.parse(req.body);
  if (body.pickupZone === body.destZone) {
    return res
      .status(400)
      .json({ error: "Pickup and destination cannot be the same zone" });
  }

  const estimate = calculateFare({
    pickupZone: body.pickupZone,
    destZone: body.destZone,
    isPooled: false,
  });

  const rideRequest = await prisma.rideRequest.create({
    data: {
      passengerId: req.user.sub,
      pickupZone: body.pickupZone,
      destZone: body.destZone,
      seats: body.seats,
      estimatedFare: estimate.farePoysha,
    },
  });

  const pool = await matchRideRequest(rideRequest);

  const membership = pool.members.find(
    (m) => m.rideRequestId === rideRequest.id,
  );
  return res.status(201).json({
    rideRequestId: rideRequest.id,
    poolId: pool.id,
    status: pool.status,
    fareInPoysha: membership.fareInPoysha,
    poolSize: pool.members.length,
    seatsOccupied: pool.seatsOccupied,
  });
}

async function myRides(req, res) {
  const rides = await prisma.rideRequest.findMany({
    where: { passengerId: req.user.sub },
    orderBy: { createdAt: "desc" },
    include: {
      membership: { include: { pool: { include: { tesla: true } } } },
    },
  });
  res.json(rides.map(serializeRideForPassenger));
}

async function getRide(req, res) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: req.params.id },
    include: {
      membership: { include: { pool: { include: { tesla: true } } } },
    },
  });
  if (!ride) return res.status(404).json({ error: "Not found" });
  // A passenger can only ever see their own ride's fare/status — never another rider's.
  if (ride.passengerId !== req.user.sub)
    return res.status(403).json({ error: "Forbidden" });
  res.json(serializeRideForPassenger(ride));
}

async function cancelRide(req, res) {
  const rr = await cancelRideRequest(req.params.id, req.user.sub);
  res.json({ id: rr.id, status: "CANCELLED" });
}

function serializeRideForPassenger(ride) {
  return {
    id: ride.id,
    pickupZone: ride.pickupZone,
    destZone: ride.destZone,
    seats: ride.seats,
    status: ride.status,
    fareInPoysha: ride.membership
      ? ride.membership.fareInPoysha
      : ride.estimatedFare,
    tesla: ride.membership ? { name: ride.membership.pool.tesla.name } : null,
    poolId: ride.membership ? ride.membership.poolId : null,
    createdAt: ride.createdAt,
  };
}

module.exports = { createRide, myRides, getRide, cancelRide, listZones };
