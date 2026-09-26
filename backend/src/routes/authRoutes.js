const router = require("express").Router();
const { register, login } = require("../controllers/authController");

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a passenger or driver
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string, example: Nusrat }
 *               email: { type: string, example: nusrat@example.com }
 *               password: { type: string, example: password123 }
 *               role: { type: string, enum: [PASSENGER, DRIVER] }
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email already registered }
 */
router.post("/register", register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: JWT + user profile }
 *       401: { description: Invalid credentials }
 */
router.post("/login", login);

module.exports = router;
