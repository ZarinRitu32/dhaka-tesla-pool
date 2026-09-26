import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, saveSession } from "../api/client.js";

export default function Login() {
  const [email, setEmail] = useState("nusrat@teslapool.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.login({ email, password });
      saveSession(token, user);
      navigate(user.role === "DRIVER" ? "/driver" : "/request");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card narrow">
      <h2>Log in</h2>
      <form onSubmit={onSubmit}>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="hint">Demo cast: nusrat@teslapool.dev / rafiq@teslapool.dev / shirin@teslapool.dev (passengers), jashim@teslapool.dev (driver). Password: password123</p>
      <p><Link to="/register">Need an account?</Link></p>
    </div>
  );
}
