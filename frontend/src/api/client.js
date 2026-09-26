const API_URL = import.meta.env.VITE_API_URL || "";
const BASE = API_URL ? `${API_URL.replace(/\/+$/, "")}/api` : "/api";

function getToken() {
  return localStorage.getItem("dtp_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (payload) =>
    request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) =>
    request("/auth/login", { method: "POST", body: payload, auth: false }),
  zones: () => request("/rides/zones", { auth: false }),
  createRide: (payload) => request("/rides", { method: "POST", body: payload }),
  myRides: () => request("/rides"),
  getRide: (id) => request(`/rides/${id}`),
  cancelRide: (id) => request(`/rides/${id}/cancel`, { method: "POST" }),
  myTeslas: () => request("/driver/teslas"),
  createTesla: (payload) =>
    request("/driver/teslas", { method: "POST", body: payload }),
  setTeslaOnline: (teslaId, isOnline) =>
    request(`/driver/teslas/${teslaId}/online`, {
      method: "POST",
      body: { isOnline },
    }),
  myPools: () => request("/driver/pools"),
  transitionPool: (poolId, status) =>
    request(`/driver/pools/${poolId}/status`, {
      method: "POST",
      body: { status },
    }),
};

export function saveSession(token, user) {
  localStorage.setItem("dtp_token", token);
  localStorage.setItem("dtp_user", JSON.stringify(user));
}

export function getSession() {
  const token = getToken();
  const userRaw = localStorage.getItem("dtp_user");
  if (!token || !userRaw) return null;
  return { token, user: JSON.parse(userRaw) };
}

export function clearSession() {
  localStorage.removeItem("dtp_token");
  localStorage.removeItem("dtp_user");
}
