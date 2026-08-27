import { apiClient } from "./client";
import type { User } from "../types";

export async function fetchMe(): Promise<{ user: User }> {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
  localStorage.removeItem("token");
}

export function getGoogleLoginUrl(): string {
  const base = import.meta.env.VITE_API_URL || "/api";
  // If base is /api (proxy), this resolves to /api/auth/google → backend 4000 via vite proxy
  return `${base}/auth/google`;
}

export function handleAuthCallback(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    localStorage.setItem("token", token);
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    return token;
  }
  return localStorage.getItem("token");
}

export async function devLogin(email = "dev@example.com"): Promise<{ token: string }> {
  const { data } = await apiClient.post("/auth/dev-login", { email, name: "Dev User" });
  localStorage.setItem("token", data.token);
  return data;
}
