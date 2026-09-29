const { isPoolCompatible, distanceKm } = require("../src/utils/zones");
const {
  calculateFare,
  BASE_FARE_POYSHA,
  PER_KM_POYSHA,
  POOL_DISCOUNT_PCT,
  poyshaToTakaDisplay,
} = require("../src/services/fareService");

describe("Pooling, Matching Rules and Fare Calculation", () => {
  describe("Matching Rules (isPoolCompatible)", () => {
    test("Banani -> Mohakhali and Banani -> Gulshan1 are compatible (same pickup, spread <= 3km)", () => {
      const reqNusrat = { pickupZone: "Banani", destZone: "Mohakhali", seats: 1 };
      const reqRafiq = { pickupZone: "Banani", destZone: "Gulshan1", seats: 1 };

      const spread = distanceKm(reqNusrat.destZone, reqRafiq.destZone);
      expect(spread).toBeLessThanOrEqual(3);
      expect(isPoolCompatible(reqNusrat, reqRafiq)).toBe(true);
    });

    test("requests with different pickup zones are not compatible", () => {
      const reqA = { pickupZone: "Banani", destZone: "Mohakhali", seats: 1 };
      const reqB = { pickupZone: "Dhanmondi", destZone: "Mohakhali", seats: 1 };

      expect(isPoolCompatible(reqA, reqB)).toBe(false);
    });

    test("requests with destination spread > 3km are not compatible", () => {
      const reqA = { pickupZone: "Banani", destZone: "Mohakhali", seats: 1 };
      const reqB = { pickupZone: "Banani", destZone: "Uttara", seats: 1 };

      const spread = distanceKm(reqA.destZone, reqB.destZone);
      expect(spread).toBeGreaterThan(3);
      expect(isPoolCompatible(reqA, reqB)).toBe(false);
    });
  });

  describe("Fare Computation", () => {
    test("constants match requirements: base=3000 poysha, perKm=1500 poysha, discount=20%", () => {
      expect(BASE_FARE_POYSHA).toBe(3000);
      expect(PER_KM_POYSHA).toBe(1500);
      expect(POOL_DISCOUNT_PCT).toBe(20);
    });

    test("solo fare does not apply pool discount", () => {
      const fare = calculateFare({
        pickupZone: "Banani",
        destZone: "Mohakhali",
        isPooled: false,
      });

      expect(fare.poolDiscountPoysha).toBe(0);
      expect(fare.farePoysha).toBe(fare.baseFarePoysha + fare.distanceChargePoysha);
      expect(Number.isInteger(fare.farePoysha)).toBe(true);
    });

    test("pooled fare computes correctly for Banani -> Mohakhali with 20% discount", () => {
      const fare = calculateFare({
        pickupZone: "Banani",
        destZone: "Mohakhali",
        isPooled: true,
      });

      // distanceKm(Banani, Mohakhali) is 1.6 km
      // distanceCharge = 1500 * 1.6 = 2400 poysha
      // poolDiscount = 2400 * 20% = 480 poysha
      // fare = 3000 + 2400 - 480 = 4920 poysha (৳49.20)
      expect(fare.km).toBe(1.6);
      expect(fare.distanceChargePoysha).toBe(2400);
      expect(fare.poolDiscountPoysha).toBe(480);
      expect(fare.farePoysha).toBe(4920);
      expect(poyshaToTakaDisplay(fare.farePoysha)).toBe("৳49.20");
      expect(Number.isInteger(fare.farePoysha)).toBe(true);
    });

    test("all fare components remain integers in poysha", () => {
      const zones = ["Banani", "Gulshan1", "Mohakhali", "Dhanmondi", "Mirpur"];
      for (const from of zones) {
        for (const to of zones) {
          if (from === to) continue;
          const solo = calculateFare({ pickupZone: from, destZone: to, isPooled: false });
          const pooled = calculateFare({ pickupZone: from, destZone: to, isPooled: true });

          expect(Number.isInteger(solo.farePoysha)).toBe(true);
          expect(Number.isInteger(pooled.farePoysha)).toBe(true);
          expect(pooled.farePoysha).toBeLessThanOrEqual(solo.farePoysha);
        }
      }
    });
  });
});
