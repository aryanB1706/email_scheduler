import { apiClient } from "./client";
import type { HealthResponse } from "../types";

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>("/health");
  return data;
}

export async function fetchHello(): Promise<{ message: string; version: string }> {
  const { data } = await apiClient.get("/");
  return data;
}
