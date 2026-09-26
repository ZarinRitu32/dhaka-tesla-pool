const { calculateFare } = require("../src/services/fareService");

describe("fareService.calculateFare", () => {
  test("Nusrat's solo fare Banani -> Mohakhali (no pool)", () => {
    const { farePoysha, km } = calculateFare({ pickupZone: "Banani", destZone: "Mohakhali", isPooled: false });
    expect(km).toBeGreaterThan(0);
    expect(farePoysha).toBe(3000 + Math.round(1500 * km));
  });

  test("pooled fare is strictly less than solo fare for the same trip", () => {
    const solo = calculateFare({ pickupZone: "Banani", destZone: "Mohakhali", isPooled: false });
    const pooled = calculateFare({ pickupZone: "Banani", destZone: "Mohakhali", isPooled: true });
    expect(pooled.farePoysha).toBeLessThan(solo.farePoysha);
    expect(pooled.poolDiscountPoysha).toBe(Math.round(pooled.distanceChargePoysha * 0.2));
  });

  test("unknown zone throws", () => {
    expect(() => calculateFare({ pickupZone: "Nowhere", destZone: "Banani", isPooled: false })).toThrow();
  });
});
