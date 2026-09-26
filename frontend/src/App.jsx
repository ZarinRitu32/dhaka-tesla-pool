import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import RequestRide from "./pages/RequestRide.jsx";
import MyRides from "./pages/MyRides.jsx";
import DriverDashboard from "./pages/DriverDashboard.jsx";
import { getSession, clearSession } from "./api/client.js";

function Protected({ role, children }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const session = getSession();
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">🛺 Dhaka Tesla Pool</Link>
        <nav>
          {session && session.user.role === "PASSENGER" && (
            <>
              <Link to="/request">Request a ride</Link>
              <Link to="/rides">My rides</Link>
            </>
          )}
          {session && session.user.role === "DRIVER" && <Link to="/driver">Driver dashboard</Link>}
          {session ? (
            <button className="link-btn" onClick={logout}>Log out ({session.user.name})</button>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/request"
            element={
              <Protected role="PASSENGER">
                <RequestRide />
              </Protected>
            }
          />
          <Route
            path="/rides"
            element={
              <Protected role="PASSENGER">
                <MyRides />
              </Protected>
            }
          />
          <Route
            path="/driver"
            element={
              <Protected role="DRIVER">
                <DriverDashboard />
              </Protected>
            }
          />
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}

function Home() {
  const session = getSession();
  return (
    <div className="card">
      <h1>Share a seat. Split the fare. Survive Dhaka traffic.</h1>
      {!session && <p>Log in as a passenger (Nusrat, Rafiq, Shirin) or driver (Jashim) to try it — seeded demo password is <code>password123</code>.</p>}
    </div>
  );
}
