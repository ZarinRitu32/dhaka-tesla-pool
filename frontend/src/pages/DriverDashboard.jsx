import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

const NEXT_STATUS = {
  REQUESTED: "MATCHED",
  MATCHED: "DRIVER_ARRIVED",
  DRIVER_ARRIVED: "STARTED",
  STARTED: "COMPLETED",
};

const NEXT_LABEL = {
  REQUESTED: "Accept ride",
  MATCHED: "Mark driver arrived",
  DRIVER_ARRIVED: "Start trip",
  STARTED: "Complete trip",
};

export default function DriverDashboard() {
  const [teslas, setTeslas] = useState([]);
  const [pools, setPools] = useState([]);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newCapacity, setNewCapacity] = useState(3);

  async function load() {
    try {
      const [t, p] = await Promise.all([api.myTeslas(), api.myPools()]);
      setTeslas(t);
      setPools(p);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // poll for newly matched pools
    return () => clearInterval(t);
  }, []);
  async function addTesla(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createTesla({
        name: newName.trim(),
        capacity: Number(newCapacity),
      });
      setNewName("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleOnline(tesla) {
    await api.setTeslaOnline(tesla.id, !tesla.isOnline);
    load();
  }

  async function advance(pool) {
    const next = NEXT_STATUS[pool.status];
    if (!next) return;
    try {
      await api.transitionPool(pool.id, next);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelPool(pool) {
    try {
      await api.transitionPool(pool.id, "CANCELLED");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h2>Driver dashboard</h2>
      {error && <p className="error">{error}</p>}

      <section>
        <h3>My Teslas</h3>
        {teslas.length === 0 && (
          <p className="hint">
            You don't own a Tesla yet — passengers can never be matched to you
            until you add one and go online.
          </p>
        )}
        {teslas.map((t) => (
          <div key={t.id} className="row">
            <span>
              {t.name} (capacity {t.capacity})
            </span>
            <button onClick={() => toggleOnline(t)}>
              {t.isOnline ? "Go offline" : "Go online"}
            </button>
          </div>
        ))}
        <form className="row" onSubmit={addTesla} style={{ marginTop: 10 }}>
          <input
            placeholder="Tesla name (e.g. Bullet)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ display: "inline-block", width: "auto", flex: 1 }}
          />
          <input
            type="number"
            min="1"
            max="6"
            value={newCapacity}
            onChange={(e) => setNewCapacity(e.target.value)}
            style={{ display: "inline-block", width: 70 }}
          />
          <button type="submit">Add Tesla</button>
        </form>
      </section>

      <section>
        <h3>Rides / pools</h3>
        {pools.length === 0 && (
          <p>No pools yet — waiting for passenger requests.</p>
        )}
        {pools.map((p) => (
          <div key={p.id} className="pool-card">
            <div className="pool-header">
              <strong>{p.teslaName}</strong> — {p.seatsOccupied}/{p.capacity}{" "}
              seats —{" "}
              <span className={`status status-${p.status.toLowerCase()}`}>
                {p.status}
              </span>
            </div>
            <ul>
              {p.passengers.map((pass, i) => (
                <li key={i}>
                  {pass.name}: {pass.pickupZone} → {pass.destZone} ({pass.seats}{" "}
                  seat) — ৳{(pass.fareInPoysha / 100).toFixed(2)}
                </li>
              ))}
            </ul>
            <div className="row">
              {NEXT_STATUS[p.status] && (
                <button onClick={() => advance(p)}>
                  {NEXT_LABEL[p.status]}
                </button>
              )}
              {["REQUESTED", "MATCHED", "DRIVER_ARRIVED"].includes(
                p.status,
              ) && <button onClick={() => cancelPool(p)}>Cancel</button>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
