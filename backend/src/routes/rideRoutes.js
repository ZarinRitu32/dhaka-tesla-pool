const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { createRide, myRides, getRide, cancelRide, listZones } = require("../controllers/rideController");

/**
 * @openapi
 * /api/rides/zones:
 *   get:
 *     tags: [Rides]
 *     summary: List valid pickup/destination zone names
 *     responses:
 *       200: { description: Array of zone names }
 */
router.get("/zones", listZones);

router.use(requireAuth, requireRole("PASSENGER"));

/**
 * @openapi
 * /api/rides:
 *   post:
 *     tags: [Rides]
 *     summary: Request a ride (auto-matched into a pool or a fresh Tesla)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickupZone, destZone, seats]
 *             properties:
 *               pickupZone: { type: string, example: Banani }
 *               destZone: { type: string, example: Mohakhali }
 *               seats: { type: integer, example: 1 }
 *     responses:
 *       201: { description: Ride matched, fare estimate returned }
 *   get:
 *     tags: [Rides]
 *     summary: List the authenticated passenger's own rides
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of the caller's rides only }
 */
router.post("/", createRide);
router.get("/", myRides);

/**
 * @openapi
 * /api/rides/{id}:
 *   get:
 *     tags: [Rides]
 *     summary: Get one of the caller's own rides
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ride detail }
 *       403: { description: Not your ride }
 */
router.get("/:id", getRide);

/**
 * @openapi
 * /api/rides/{id}/cancel:
 *   post:
 *     tags: [Rides]
 *     summary: Cancel the caller's own ride, while it is still cancellable
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ride cancelled }
 *       409: { description: Ride is no longer cancellable (e.g. already STARTED) }
 */
router.post("/:id/cancel", cancelRide);

module.exports = router;
