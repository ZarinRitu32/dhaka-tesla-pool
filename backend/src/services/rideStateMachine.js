// Section: ride/pool lifecycle.
// REQUESTED -> MATCHED -> DRIVER_ARRIVED -> STARTED -> COMPLETED (+ CANCELLED from any pre-STARTED state)

const TRANSITIONS = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["STARTED", "CANCELLED"],
  STARTED: ["COMPLETED"], // once the trip has physically started, cancellation is no longer allowed
  COMPLETED: [],
  CANCELLED: [],
};

function assertValidTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Invalid ride state transition: ${from} -> ${to}`);
    err.status = 409;
    throw err;
  }
}

module.exports = { TRANSITIONS, assertValidTransition };
