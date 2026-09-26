const { assertValidTransition } = require("../src/services/rideStateMachine");

describe("ride state machine", () => {
  test("allows the documented forward path", () => {
    expect(() => assertValidTransition("REQUESTED", "MATCHED")).not.toThrow();
    expect(() => assertValidTransition("MATCHED", "DRIVER_ARRIVED")).not.toThrow();
    expect(() => assertValidTransition("DRIVER_ARRIVED", "STARTED")).not.toThrow();
    expect(() => assertValidTransition("STARTED", "COMPLETED")).not.toThrow();
  });

  test("rejects skipping states", () => {
    expect(() => assertValidTransition("REQUESTED", "STARTED")).toThrow();
    expect(() => assertValidTransition("MATCHED", "COMPLETED")).toThrow();
  });

  test("rejects cancelling a trip that has already started", () => {
    expect(() => assertValidTransition("STARTED", "CANCELLED")).toThrow();
  });

  test("rejects any transition out of a terminal state", () => {
    expect(() => assertValidTransition("COMPLETED", "CANCELLED")).toThrow();
    expect(() => assertValidTransition("CANCELLED", "MATCHED")).toThrow();
  });
});
