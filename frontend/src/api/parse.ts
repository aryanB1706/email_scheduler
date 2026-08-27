import { apiClient } from "./client";
import type { ParseRecipientsResponse } from "../types";

export async function parseRecipients(file: File): Promise<ParseRecipientsResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post("/parse-recipients", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
