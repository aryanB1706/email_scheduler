import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchScheduled, fetchSent } from "../api/emails";
import { useFetch } from "../hooks/useFetch";
import AppShell from "../components/AppShell";

type Tab = "scheduled" | "sent";

interface Props {
  initialTab?: Tab;
}

function formatScheduledDate(d: string) {
  try {
    const date = new Date(d);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = days[date.getDay()];
    let hours = date.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const mins = String(date.getMinutes()).padStart(2, "0");
    const secs = String(date.getSeconds()).padStart(2, "0");
    return `${day} ${hours}:${mins}:${secs} ${ampm}`;
  } catch {
    return d;
  }
}

export default function Dashboard({ initialTab = "scheduled" }: Props) {
  const navigate = useNavigate();
  const tab: Tab = initialTab;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Fetch both for counts
  const scheduledQ = useFetch(() => fetchScheduled({ page: tab === "scheduled" ? page : 1, limit: 20 }), [page, tab]);
  const sentQ = useFetch(() => fetchSent({ page: tab === "sent" ? page : 1, limit: 20 }), [page, tab]);

  // Also need totals for sidebar counts - fetch with limit 1 to get total quickly but we already have pagination totals
  const active = tab === "scheduled" ? scheduledQ : sentQ;

  // Client side search filter
  const filteredData = useMemo(() => {
    if (!active.data?.data) return [];
    if (!search.trim()) return active.data.data;
    const q = search.toLowerCase();
    return active.data.data.filter(
      (job: any) =>
        job.recipientEmail?.toLowerCase().includes(q) ||
        job.subject?.toLowerCase().includes(q) ||
        job.body?.toLowerCase().includes(q)
    );
  }, [active.data, search]);

  const handleRefresh = () => {
    scheduledQ.refetch();
    sentQ.refetch();
  };

  // Auto-refresh every 5s so sent/scheduled moves without reload (fixes "reload karna padta hai")
  useEffect(() => {
    const id = setInterval(() => {
      scheduledQ.refetch();
      sentQ.refetch();
    }, 5000);
    // Also refetch when tab becomes visible (user switches back to tab)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduledQ.refetch();
        sentQ.refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const scheduledCount = scheduledQ.data?.pagination.total ?? 0;
  const sentCount = sentQ.data?.pagination.total ?? 0;

  return (
    <AppShell scheduledCount={scheduledCount} sentCount={sentCount}>
      {/* Top search bar */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[#F3F5F3] px-4 py-2.5">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <button className="rounded-full p-2 text-gray-400 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
        </button>
        <button onClick={handleRefresh} className="relative rounded-full p-2 text-gray-400 hover:bg-gray-100" title="Auto-refresh every 5s">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-green-500" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {active.loading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 border-b px-6 py-4">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-4 flex-1 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : active.error ? (
          <div className="m-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{active.error}</div>
        ) : filteredData.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="rounded-full bg-gray-100 p-4">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-sm text-gray-500">
              {tab === "scheduled" ? "No scheduled emails — compose one to get started." : "No sent emails yet."}
            </p>
            {tab === "scheduled" && (
              <button onClick={() => navigate("/compose")} className="mt-1 rounded-full border border-[#00A651] px-5 py-1.5 text-sm font-medium text-[#00A651] hover:bg-[#E8F5E9]">Compose</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredData.map((job: any) => (
              <div
                key={job.id}
                onClick={() => navigate(`/email/${job.id}`, { state: job })}
                className="flex cursor-pointer items-center gap-4 px-6 py-3.5 hover:bg-[#FAFBFA] transition group"
              >
                {/* Left: To */}
                <div className="w-[140px] shrink-0 truncate text-sm font-medium text-gray-900">To: {job.recipientEmail?.split("@")[0] ? job.recipientEmail.split("@")[0].charAt(0).toUpperCase() + job.recipientEmail.split("@")[0].slice(1) : job.recipientEmail}</div>

                {/* Middle: badge + subject snippet */}
                <div className="flex flex-1 items-center gap-2 overflow-hidden">
                  {tab === "scheduled" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FFEEDB] px-2 py-1 text-[11px] font-medium text-[#D46B08] border border-[#FFD8A8]">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {formatScheduledDate(job.scheduledAt)}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 border border-gray-200">Sent</span>
                  )}
                  <span className="truncate text-sm">
                    <span className="font-medium text-gray-900">{job.subject || "(no subject)"}</span>
                    <span className="text-gray-400"> - {job.body ? job.body.replace(/<[^>]*>/g, "").slice(0, 60) : "Hi, just wanted to follow up on our meeting..."}</span>
                  </span>
                </div>

                {/* Right star */}
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="shrink-0 text-gray-300 hover:text-gray-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {active.data && active.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-6 py-3 text-sm">
          <span className="text-gray-500">Page {active.data.pagination.page} of {active.data.pagination.totalPages} — {active.data.pagination.total} total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-full border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page >= active.data.pagination.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-full border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
