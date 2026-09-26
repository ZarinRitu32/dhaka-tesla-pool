/**
 * Integration-style test documenting the capacity/concurrency behaviour of
 * reserveSeatsAtomically. Requires a real Postgres (set DATABASE_URL and run
 * `npx prisma migrate deploy` first) — skipped automatically otherwise so
 * `npm test` still runs the pure unit tests in CI without a DB.
 *
 * Simulates the exact Section 12 scenario: Bullet has 1 seat left, Nusrat and
 * Shirin both race for it. Exactly one reservation must succeed.
 */
const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("pool capacity concurrency", () => {
  const prisma = require("../src/config/db");
  const { reserveSeatsAtomically } = require("../src/services/poolService");

  let tesla, pool, driver;

  beforeAll(async () => {
    driver = await prisma.user.create({
      data: { name: "TestDriver", email: `driver_${Date.now()}@test.dev`, passwordHash: "x", role: "DRIVER" },
    });
    tesla = await prisma.tesla.create({ data: { driverId: driver.id, name: "TestTesla", capacity: 3, isOnline: true } });
    pool = await prisma.pool.create({ data: { teslaId: tesla.id, matchZone: "Banani", status: "MATCHED", seatsOccupied: 2 } });
  });

  afterAll(async () => {
    await prisma.pool.delete({ where: { id: pool.id } });
    await prisma.tesla.delete({ where: { id: tesla.id } });
    await prisma.user.delete({ where: { id: driver.id } });
    await prisma.$disconnect();
  });

  test("only one of two concurrent 1-seat claims for the last seat succeeds", async () => {
    const [resultA, resultB] = await Promise.all([
      reserveSeatsAtomically(pool.id, 1, tesla.capacity),
      reserveSeatsAtomically(pool.id, 1, tesla.capacity),
    ]);
    const successCount = [resultA, resultB].filter(Boolean).length;
    expect(successCount).toBe(1);

    const finalPool = await prisma.pool.findUnique({ where: { id: pool.id } });
    expect(finalPool.seatsOccupied).toBe(3); // never exceeds capacity
  });
});
