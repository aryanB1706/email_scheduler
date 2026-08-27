import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
  withCredentials: true,
});

// Attach JWT from localStorage if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // Auto-logout on 401 to avoid stale token loops (except for /auth/me which intentionally 401s)
    if (err?.response?.status === 401 && !err.config?.url?.includes("/auth/me")) {
      console.warn("[api] 401", err?.response?.data);
    }
    return Promise.reject(err);
  }
);
