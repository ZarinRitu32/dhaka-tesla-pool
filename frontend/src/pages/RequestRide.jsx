import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function RequestRide() {
  const [zones, setZones] = useState([]);
  const [pickupZone, setPickupZone] = useState("Banani");
  const [destZone, setDestZone] = useState("Mohakhali");
  const [seats, setSeats] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .zones()
      .then(setZones)
      .catch(() =>
        setZones([
          "Banani",
          "Gulshan1",
          "Mohakhali",
          "Dhanmondi",
          "Mirpur",
          "Uttara",
          "Farmgate",
          "Bashundhara",
        ]),
      );
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await api.createRide({
        pickupZone,
        destZone,
        seats: Number(seats),
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result?.rideRequestId) return;
    if (["COMPLETED", "CANCELLED"].includes(result.status)) return;
    const interval = setInterval(async () => {
      try {
        const ride = await api.getRide(result.rideRequestId);
        if (ride.status && ride.status !== result.status) {
          setResult((prev) => ({ ...prev, status: ride.status }));
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [result]);

  return (
    <div className="card narrow">
      <h2>Request a ride</h2>
      <form onSubmit={onSubmit}>
        <label>
          Pickup
          <select
            value={pickupZone}
            onChange={(e) => setPickupZone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination
          <select
            value={destZone}
            onChange={(e) => setDestZone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seats
          <input
            type="number"
            min="1"
            max="3"
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>
          {loading ? "Matching…" : "Request ride"}
        </button>
      </form>
      {result && (
        <div className="result">
          <p>
            <strong>
              {result.status === "REQUESTED"
                ? "Request sent — waiting for driver"
                : "Matched!"}
            </strong>{" "}
            Status: {result.status}
          </p>
          <p>Fare: ৳{(result.fareInPoysha / 100).toFixed(2)}</p>
          <p>
            Pool size: {result.poolSize} passenger(s), {result.seatsOccupied}{" "}
            seat(s) occupied
          </p>
        </div>
      )}
    </div>
  );
}
