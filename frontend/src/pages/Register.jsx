import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "PASSENGER" });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.register(form);
      setDone(true);
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card narrow">
      <h2>Register</h2>
      <form onSubmit={onSubmit}>
        <label>Name<input value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
        <label>Email<input value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} /></label>
        <label>
          Role
          <select value={form.role} onChange={(e) => update("role", e.target.value)}>
            <option value="PASSENGER">Passenger</option>
            <option value="DRIVER">Driver</option>
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        {done && <p className="success">Registered! Redirecting to login…</p>}
        <button>Create account</button>
      </form>
    </div>
  );
}
