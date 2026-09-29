const { distanceKm } = require("../utils/zones");

// All money in INTEGER POYSHA (1 Taka = 100 poysha). We never use floats/decimals
// for money: floating point rounding (e.g. 0.1 + 0.2 !== 0.3) is unacceptable for
// anything billed to a passenger, and integer poysha keeps every arithmetic step
// exact while still allowing sub-taka precision when discounts are applied.

const BASE_FARE_POYSHA = 3000; // 30 Taka flat base
const PER_KM_POYSHA = 1500; // 15 Taka / km
const POOL_DISCOUNT_PCT = 20; // 20% off the distance charge when pooled with >=1 other passenger

/**
 * passengerFare = baseFare + distanceCharge - poolDiscount
 * distanceCharge = perKmCharge * distanceKm (rounded to nearest poysha)
 * poolDiscount   = distanceCharge * poolDiscountPct / 100, applied ONLY when
 *                  the pool has more than one distinct passenger.
 *
 * Worked example (Nusrat, Banani -> Mohakhali, pooled with Rafiq):
 *   distanceKm(Banani, Mohakhali) = 1.6 km
 *   distanceCharge = 1500 * 1.6 = 2400 poysha
 *   poolDiscount   = 2400 * 20 / 100 = 480 poysha
 *   fare           = 3000 + 2400 - 480 = 4920 poysha = 49.20 Taka
 */
function calculateFare({ pickupZone, destZone, isPooled }) {
  const km = distanceKm(pickupZone, destZone);
  const distanceCharge = Math.round(PER_KM_POYSHA * km);
  const poolDiscount = isPooled
    ? Math.round((distanceCharge * POOL_DISCOUNT_PCT) / 100)
    : 0;
  const fare = BASE_FARE_POYSHA + distanceCharge - poolDiscount;
  return {
    km,
    baseFarePoysha: BASE_FARE_POYSHA,
    distanceChargePoysha: distanceCharge,
    poolDiscountPoysha: poolDiscount,
    farePoysha: fare,
  };
}

function poyshaToTakaDisplay(poysha) {
  return `৳${(poysha / 100).toFixed(2)}`;
}

module.exports = {
  calculateFare,
  poyshaToTakaDisplay,
  BASE_FARE_POYSHA,
  PER_KM_POYSHA,
  POOL_DISCOUNT_PCT,
};
