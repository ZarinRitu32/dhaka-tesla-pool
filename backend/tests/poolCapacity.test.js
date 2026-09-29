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
});
