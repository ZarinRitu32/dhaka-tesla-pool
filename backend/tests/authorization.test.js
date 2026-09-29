process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-12345";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");

describe("Authorization and User Isolation", () => {
  const passengerToken = jwt.sign(
    { sub: "passenger-1", role: "PASSENGER", name: "Nusrat" },
    process.env.JWT_SECRET,
  );
  const otherPassengerToken = jwt.sign(
    { sub: "passenger-2", role: "PASSENGER", name: "Rafiq" },
    process.env.JWT_SECRET,
  );
  const driverToken = jwt.sign(
    { sub: "driver-1", role: "DRIVER", name: "Jashim" },
    process.env.JWT_SECRET,
  );
  const otherDriverToken = jwt.sign(
    { sub: "driver-2", role: "DRIVER", name: "OtherDriver" },
    process.env.JWT_SECRET,
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Token & JWT Protection", () => {
    test("rejects protected routes when Bearer token is missing (401)", async () => {
      const res = await request(app).get("/api/rides");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing bearer token/i);
    });

    test("rejects protected routes when token is invalid or tampered (401)", async () => {
      const res = await request(app)
        .get("/api/rides")
        .set("Authorization", "Bearer invalid-token-string");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or expired token/i);
    });
  });

  describe("Role-Based Access Control", () => {
    test("passenger cannot access driver-only routes (403)", async () => {
      const res = await request(app)
        .get("/api/driver/teslas")
        .set("Authorization", `Bearer ${passengerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/requires role DRIVER/i);
    });

    test("driver cannot access passenger-only ride request route (403)", async () => {
      const res = await request(app)
        .get("/api/rides")
        .set("Authorization", `Bearer ${driverToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/requires role PASSENGER/i);
    });
  });

  describe("Ownership & User Isolation", () => {
    test("passenger cannot view another passenger's ride (403)", async () => {
      jest.spyOn(prisma.rideRequest, "findUnique").mockResolvedValue({
        id: "ride-1",
        passengerId: "passenger-2", // belongs to Rafiq
        pickupZone: "Banani",
        destZone: "Mohakhali",
        seats: 1,
        status: "REQUESTED",
        estimatedFare: 5040,
        membership: null,
      });

      const res = await request(app)
        .get("/api/rides/ride-1")
        .set("Authorization", `Bearer ${passengerToken}`); // Nusrat requests

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden/i);
    });

    test("passenger cannot cancel another passenger's ride (403)", async () => {
      jest.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
        return callback({
          rideRequest: {
            findUnique: jest.fn().mockResolvedValue({
              id: "ride-1",
              passengerId: "passenger-2", // belongs to Rafiq
              status: "REQUESTED",
              membership: null,
            }),
          },
        });
      });

      const res = await request(app)
        .post("/api/rides/ride-1/cancel")
        .set("Authorization", `Bearer ${passengerToken}`); // Nusrat attempts cancel

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/only cancel your own ride/i);
    });

    test("driver cannot toggle online status of another driver's Tesla (403)", async () => {
      jest.spyOn(prisma.tesla, "findUnique").mockResolvedValue({
        id: "tesla-bullet",
        driverId: "driver-1", // belongs to Jashim
        name: "Bullet",
        capacity: 3,
        isOnline: false,
      });

      const res = await request(app)
        .post("/api/driver/teslas/tesla-bullet/online")
        .set("Authorization", `Bearer ${otherDriverToken}`) // other driver attempts
        .send({ isOnline: true });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not your tesla/i);
    });

    test("driver cannot transition a pool belonging to another driver's Tesla (403)", async () => {
      jest.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
        return callback({
          pool: {
            findUnique: jest.fn().mockResolvedValue({
              id: "pool-1",
              tesla: { driverId: "driver-1" }, // belongs to Jashim
              status: "REQUESTED",
            }),
          },
        });
      });

      const res = await request(app)
        .post("/api/driver/pools/pool-1/status")
        .set("Authorization", `Bearer ${otherDriverToken}`) // other driver attempts
        .send({ status: "MATCHED" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not your tesla/i);
    });
  });
});
