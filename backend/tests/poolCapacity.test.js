const prisma = require("../src/config/db");
const { reserveSeatsAtomically } = require("../src/services/poolService");

describe("pool capacity and concurrency", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("rejects invalid seat requests outside vehicle capacity bounds", async () => {
    expect(await reserveSeatsAtomically("pool-1", 0, 3)).toBe(false);
    expect(await reserveSeatsAtomically("pool-1", -1, 3)).toBe(false);
    expect(await reserveSeatsAtomically("pool-1", 4, 3)).toBe(false);
  });

  test("last seat concurrency: only one of two concurrent claims for the last seat succeeds", async () => {
    let seatsOccupied = 2;
    const capacity = 3;

    // Simulate Postgres row-level locking where concurrent atomic UPDATE queries serialize:
    // UPDATE "Pool" SET "seatsOccupied" = "seatsOccupied" + $1 WHERE "seatsOccupied" + $1 <= $3
    jest
      .spyOn(prisma, "$queryRawUnsafe")
      .mockImplementation(async (query, seats, poolId, cap) => {
        if (seatsOccupied + seats <= cap) {
          seatsOccupied += seats;
          return [{ id: poolId }];
        }
        return [];
      });

    const [claimA, claimB] = await Promise.all([
      reserveSeatsAtomically("pool-1", 1, capacity),
      reserveSeatsAtomically("pool-1", 1, capacity),
    ]);

    const successCount = [claimA, claimB].filter(Boolean).length;
    expect(successCount).toBe(1);
    expect(seatsOccupied).toBe(3);
  });

  test("matchRideRequest rejects 4th passenger when 3-seat pool is full and no other Tesla is available", async () => {
    const { matchRideRequest } = require("../src/services/poolService");

    // Full pool: seatsOccupied = 3, capacity = 3
    const fullPool = {
      id: "pool-full",
      matchZone: "Banani",
      status: "REQUESTED",
      seatsOccupied: 3,
      tesla: { capacity: 3 },
      members: [
        { rideRequest: { pickupZone: "Banani", destZone: "Mohakhali", status: "REQUESTED" } },
        { rideRequest: { pickupZone: "Banani", destZone: "Gulshan1", status: "REQUESTED" } },
        { rideRequest: { pickupZone: "Banani", destZone: "Mohakhali", status: "REQUESTED" } },
      ],
    };

    jest.spyOn(prisma.pool, "findMany").mockResolvedValue([fullPool]);
    // No idle online Tesla available (Bullet is already running an active pool)
    jest.spyOn(prisma.tesla, "findFirst").mockResolvedValue(null);

    await expect(
      matchRideRequest({
        id: "req-4",
        passengerId: "passenger-4",
        pickupZone: "Banani",
        destZone: "Mohakhali",
        seats: 1,
      }),
    ).rejects.toThrow("No online Tesla available right now");
  });
});
