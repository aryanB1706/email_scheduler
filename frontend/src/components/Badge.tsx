import type { BadgeStatus } from "../types";

const colors: Record<BadgeStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  queued: "bg-blue-100 text-blue-800 border-blue-200",
  sent: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  default: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function Badge({ status }: { status: BadgeStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.default}`}>{status}</span>;
}
