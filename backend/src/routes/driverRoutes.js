const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  myTeslas,
  createTesla,
  setTeslaOnline,
  myPools,
  transitionPool,
} = require("../controllers/driverController");

router.use(requireAuth, requireRole("DRIVER"));

/**
 * @openapi
 * /api/driver/teslas:
 *   get:
 *     tags: [Driver]
 *     summary: List the authenticated driver's own Teslas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of Teslas owned by the caller }
 */
router.get("/teslas", myTeslas);

/**
 * @openapi
 * /api/driver/teslas/{teslaId}/online:
 *   post:
 *     tags: [Driver]
 *     summary: Go online/offline with a Tesla
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teslaId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isOnline]
 *             properties: { isOnline: { type: boolean } }
 *     responses:
 *       200: { description: Updated Tesla }
 *       403: { description: Not your Tesla }
 */
router.post("/teslas", createTesla);

router.post("/teslas/:teslaId/online", setTeslaOnline);

/**
 * @openapi
 * /api/driver/pools:
 *   get:
 *     tags: [Driver]
 *     summary: List pools (rides) on the caller's own Teslas, with passengers/seats/fares and status
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of pools }
 */
router.get("/pools", myPools);

/**
 * @openapi
 * /api/driver/pools/{poolId}/status:
 *   post:
 *     tags: [Driver]
 *     summary: Advance a pool's ride status (MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED, or CANCELLED)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [MATCHED, DRIVER_ARRIVED, STARTED, COMPLETED, CANCELLED] }
 *     responses:
 *       200: { description: Pool status updated }
 *       409: { description: Invalid state transition }
 */
router.post("/pools/:poolId/status", transitionPool);

module.exports = router;
