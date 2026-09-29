const {
  transitionPoolStatus,
  cancelRideRequest,
} = require("../src/services/poolService");
const { assertValidTransition } = require("../src/services/rideStateMachine");

describe("Ride Lifecycle and Cancellation State Machine", () => {
  describe("State Transition Validation", () => {
    test("allows standard forward ride progression", () => {
      expect(() => assertValidTransition("REQUESTED", "MATCHED")).not.toThrow();
      expect(() => assertValidTransition("MATCHED", "DRIVER_ARRIVED")).not.toThrow();
      expect(() => assertValidTransition("DRIVER_ARRIVED", "STARTED")).not.toThrow();
      expect(() => assertValidTransition("STARTED", "COMPLETED")).not.toThrow();
    });

    test("allows cancellation only from pre-started states", () => {
      expect(() => assertValidTransition("REQUESTED", "CANCELLED")).not.toThrow();
      expect(() => assertValidTransition("MATCHED", "CANCELLED")).not.toThrow();
      expect(() => assertValidTransition("DRIVER_ARRIVED", "CANCELLED")).not.toThrow();
    });

    test("rejects invalid skipping of states", () => {
      expect(() => assertValidTransition("REQUESTED", "STARTED")).toThrow();
      expect(() => assertValidTransition("REQUESTED", "COMPLETED")).toThrow();
      expect(() => assertValidTransition("MATCHED", "COMPLETED")).toThrow();
    });

    test("rejects cancelling a ride that has already started", () => {
      expect(() => assertValidTransition("STARTED", "CANCELLED")).toThrow();
    });

    test("rejects transitions out of terminal states (COMPLETED / CANCELLED)", () => {
      expect(() => assertValidTransition("COMPLETED", "STARTED")).toThrow();
      expect(() => assertValidTransition("COMPLETED", "CANCELLED")).toThrow();
      expect(() => assertValidTransition("CANCELLED", "MATCHED")).toThrow();
      expect(() => assertValidTransition("CANCELLED", "STARTED")).toThrow();
    });
  });

  describe("Lifecycle Execution & Audit Trail (RideEvent)", () => {
    test("transitionPoolStatus records timestamp, updates status and writes RideEvent", async () => {
      const mockPool = {
        id: "pool-1",
        status: "REQUESTED",
        tesla: { driverId: "driver-jashim" },
      };

      const mockTx = {
        pool: {
          findUnique: jest.fn().mockResolvedValue(mockPool),
          update: jest.fn().mockResolvedValue({ id: "pool-1", status: "MATCHED" }),
        },
        rideRequest: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        rideEvent: {
          create: jest.fn().mockResolvedValue({ id: "event-1" }),
        },
      };

      const prisma = require("../src/config/db");
      jest.spyOn(prisma, "$transaction").mockImplementation(async (cb) => cb(mockTx));

      const updated = await transitionPoolStatus("pool-1", "driver-jashim", "MATCHED");

      expect(updated.status).toBe("MATCHED");
      expect(mockTx.pool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pool-1" },
          data: expect.objectContaining({
            status: "MATCHED",
            matchedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockTx.rideRequest.updateMany).toHaveBeenCalledWith({
        where: { membership: { poolId: "pool-1" } },
        data: { status: "MATCHED" },
      });
      expect(mockTx.rideEvent.create).toHaveBeenCalledWith({
        data: {
          poolId: "pool-1",
          event: "STATUS_CHANGED:MATCHED",
          actorId: "driver-jashim",
        },
      });
    });

    test("cancelRideRequest decrements occupied seats and writes PASSENGER_CANCELLED event", async () => {
      const mockRideRequest = {
        id: "rr-1",
        passengerId: "passenger-nusrat",
        status: "MATCHED",
        membership: {
          poolId: "pool-1",
          seats: 1,
        },
      };

      const mockTx = {
        rideRequest: {
          findUnique: jest.fn().mockResolvedValue(mockRideRequest),
          update: jest.fn().mockResolvedValue({ id: "rr-1", status: "CANCELLED" }),
        },
        pool: {
          update: jest.fn().mockResolvedValue({ id: "pool-1" }),
        },
        rideEvent: {
          create: jest.fn().mockResolvedValue({ id: "event-2" }),
        },
      };

      const prisma = require("../src/config/db");
      jest.spyOn(prisma, "$transaction").mockImplementation(async (cb) => cb(mockTx));

      const cancelled = await cancelRideRequest("rr-1", "passenger-nusrat");

      expect(cancelled.id).toBe("rr-1");
      expect(mockTx.rideRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rr-1" },
          data: expect.objectContaining({
            status: "CANCELLED",
            cancelledAt: expect.any(Date),
          }),
        }),
      );
      expect(mockTx.pool.update).toHaveBeenCalledWith({
        where: { id: "pool-1" },
        data: { seatsOccupied: { decrement: 1 } },
      });
      expect(mockTx.rideEvent.create).toHaveBeenCalledWith({
        data: {
          poolId: "pool-1",
          event: "PASSENGER_CANCELLED",
          actorId: "passenger-nusrat",
          payload: { rideRequestId: "rr-1" },
        },
      });
    });

    test("cancelRideRequest throws 409 when cancelling already STARTED ride", async () => {
      const mockRideRequest = {
        id: "rr-1",
        passengerId: "passenger-nusrat",
        status: "STARTED",
        membership: { poolId: "pool-1", seats: 1 },
      };

      const mockTx = {
        rideRequest: {
          findUnique: jest.fn().mockResolvedValue(mockRideRequest),
        },
      };

      const prisma = require("../src/config/db");
      jest.spyOn(prisma, "$transaction").mockImplementation(async (cb) => cb(mockTx));

      await expect(cancelRideRequest("rr-1", "passenger-nusrat")).rejects.toThrow(
        /Invalid ride state transition: STARTED -> CANCELLED/,
      );
    });
  });
});
