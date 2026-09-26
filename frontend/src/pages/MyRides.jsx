import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

const CANCELLABLE = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED"];

export default function MyRides() {
  const [rides, setRides] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setRides(await api.myRides());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // simple polling so status updates as the driver progresses
    return () => clearInterval(t);
  }, []);

  async function cancel(id) {
    try {
      await api.cancelRide(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!rides.length) return <div className="card"><p>No rides yet.</p>{error && <p className="error">{error}</p>}</div>;

  return (
    <div className="card">
      <h2>My rides</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Route</th><th>Seats</th><th>Status</th><th>Fare</th><th>Tesla</th><th></th></tr></thead>
        <tbody>
          {rides.map((r) => (
            <tr key={r.id}>
              <td>{r.pickupZone} → {r.destZone}</td>
              <td>{r.seats}</td>
              <td><span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span></td>
              <td>৳{(r.fareInPoysha / 100).toFixed(2)}</td>
              <td>{r.tesla ? r.tesla.name : "—"}</td>
              <td>{CANCELLABLE.includes(r.status) && <button onClick={() => cancel(r.id)}>Cancel</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
