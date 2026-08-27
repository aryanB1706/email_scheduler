import { apiClient } from "./client";
import type { PaginatedResponse, EmailJob, SchedulePayload, ScheduleResponse } from "../types";

export async function fetchScheduled(params: { page?: number; limit?: number; senderId?: string } = {}): Promise<PaginatedResponse<EmailJob>> {
  const { data } = await apiClient.get("/emails/scheduled", { params });
  return data;
}

export async function fetchSent(params: { page?: number; limit?: number; senderId?: string } = {}): Promise<PaginatedResponse<EmailJob>> {
  const { data } = await apiClient.get("/emails/sent", { params });
  return data;
}

export async function scheduleEmails(payload: SchedulePayload): Promise<ScheduleResponse> {
  const { data } = await apiClient.post("/schedule", payload);
  return data;
}
