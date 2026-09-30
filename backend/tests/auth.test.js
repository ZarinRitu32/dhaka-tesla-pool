process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-12345";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const prisma = require("../src/config/db");

describe("Authentication & Authorization - /api/auth", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/auth/register", () => {
    test("registers a new passenger successfully and hashes password", async () => {
      const mockCreatedUser = {
        id: "user-123",
        name: "Test Passenger",
        email: "test_passenger@teslapool.dev",
        role: "PASSENGER",
        passwordHash: "$2a$10$hashedpasswordstring",
      };

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(null);
      jest.spyOn(prisma.user, "create").mockResolvedValue(mockCreatedUser);
      const hashSpy = jest.spyOn(bcrypt, "hash");

      const res = await request(app).post("/api/auth/register").send({
        name: "Test Passenger",
        email: "test_passenger@teslapool.dev",
        password: "securepassword",
        role: "PASSENGER",
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: "user-123",
        name: "Test Passenger",
        email: "test_passenger@teslapool.dev",
        role: "PASSENGER",
      });
      expect(res.body.passwordHash).toBeUndefined();
      expect(hashSpy).toHaveBeenCalledWith("securepassword", 10);
    });

    test("registers a new driver successfully", async () => {
      const mockCreatedDriver = {
        id: "driver-123",
        name: "Test Driver",
        email: "driver@teslapool.dev",
        role: "DRIVER",
      };

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(null);
      jest.spyOn(prisma.user, "create").mockResolvedValue(mockCreatedDriver);

      const res = await request(app).post("/api/auth/register").send({
        name: "Test Driver",
        email: "driver@teslapool.dev",
        password: "driverpassword",
        role: "DRIVER",
      });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe("DRIVER");
    });

    test("rejects registration with duplicate email (409)", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "existing-user",
        email: "duplicate@teslapool.dev",
      });

      const res = await request(app).post("/api/auth/register").send({
        name: "Duplicate User",
        email: "duplicate@teslapool.dev",
        password: "password123",
        role: "PASSENGER",
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
    });

    test("validates registration input schema (rejects short password / invalid email)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Bad Input",
        email: "not-an-email",
        password: "123", // too short (< 6 chars)
        role: "INVALID_ROLE",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    test("logs in successfully with valid credentials and returns JWT token", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const mockUser = {
        id: "user-jashim",
        name: "Jashim",
        email: "jashim@teslapool.dev",
        passwordHash: hashedPassword,
        role: "DRIVER",
      };

      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "jashim@teslapool.dev", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user).toEqual({
        id: "user-jashim",
        name: "Jashim",
        email: "jashim@teslapool.dev",
        role: "DRIVER",
      });
    });

    test("rejects login with incorrect password (401)", async () => {
      const hashedPassword = await bcrypt.hash("correct-password", 10);
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "user-nusrat",
        name: "Nusrat",
        email: "nusrat@teslapool.dev",
        passwordHash: hashedPassword,
        role: "PASSENGER",
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nusrat@teslapool.dev", password: "wrong-password" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    test("rejects login for non-existent user email (401)", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "ghost@teslapool.dev", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });
  });
});
