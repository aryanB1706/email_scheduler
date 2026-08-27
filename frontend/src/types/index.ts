export type EmailJobStatus = "pending" | "queued" | "sent" | "failed";

export interface EmailJob {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string;
  senderId: string;
  scheduledAt: string;
  status: EmailJobStatus;
  bullJobId: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
}

export type ScheduledEmail = EmailJob;

export interface Sender {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  checks: Record<string, string>;
}

// API wrappers
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ParseRecipientsResponse {
  count: number;
  totalTokens: number;
  validEmails: string[];
  invalidCount: number;
  invalidSamples: string[];
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt: string; // ISO
  delayBetweenEmailsMs?: number;
  maxEmailsPerHour?: number;
  senderId: string;
}

export interface ScheduleResponse {
  message: string;
  staggerMs: number;
  baseDelayMs: number;
  jobs: Array<{
    recipient: string;
    emailJobId: string;
    bullJobId: string;
    delayMs: number;
    scheduledAt: string;
  }>;
  errors?: Array<{ recipient: string; error: string }>;
}

// Props types for reusable components
export type BadgeStatus = EmailJobStatus | "default";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
