import { Link } from "react-router-dom";
import HealthBadge from "../components/HealthBadge";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hello from Email Scheduler</h1>
        <p className="mt-2 text-gray-600">
          Frontend scaffold is live — React + Vite + Tailwind + React Router + Axios.
        </p>
      </div>

      <HealthBadge />

      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-semibold">Next steps</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
          <li>
            Backend health: <code className="rounded bg-gray-100 px-1">GET /api/health</code>
          </li>
          <li>Prisma model `ScheduledEmail` is ready — add scheduling UI in Dashboard.</li>
          <li>BullMQ queue `email-scheduling` + worker placeholder already wired.</li>
        </ul>
        <Link
          to="/scheduled"
          className="mt-4 inline-block rounded-full bg-[#00A651] px-6 py-2 text-sm font-medium text-white hover:bg-[#009246]"
        >
          Go to Scheduled →
        </Link>
      </div>
    </div>
  );
}
