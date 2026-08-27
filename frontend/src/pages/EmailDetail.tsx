import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    queued: "bg-blue-50 text-blue-700 border-blue-200",
    sent: "bg-green-50 text-green-700 border-green-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || "bg-gray-50 text-gray-700 border-gray-200"}`}>{status}</span>;
}

export default function EmailDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const stateJob = (location.state as any) || null;
  const [job, setJob] = useState<any>(stateJob);
  const [loading, setLoading] = useState(!stateJob);
  const [starred, setStarred] = useState(false);
  const [archived, setArchived] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (id) {
      setStarred(localStorage.getItem(`starred:${id}`) === "1");
      setArchived(localStorage.getItem(`archived:${id}`) === "1");
    }
  }, [id]);

  useEffect(() => {
    if (stateJob) return;
    (async () => {
      try {
        setLoading(true);
        try {
          const res = await apiClient.get(`/emails/${id}`);
          setJob(res.data.data);
          return;
        } catch {}
        const tryFetch = async (path: string) => {
          const res = await apiClient.get(path, { params: { limit: 100 } });
          const found = res.data.data?.find((j: any) => j.id === id);
          return found;
        };
        let found = await tryFetch("/emails/scheduled");
        if (!found) found = await tryFetch("/emails/sent");
        if (found) setJob(found);
      } finally { setLoading(false); }
    })();
  }, [id, stateJob]);

  const handleStar = () => {
    const next = !starred;
    setStarred(next);
    if (id) localStorage.setItem(`starred:${id}`, next ? "1" : "0");
    showToast(next ? "★ Starred" : "☆ Unstarred");
  };

  const handleArchive = async () => {
    if (archived) {
      setArchived(false);
      if (id) localStorage.setItem(`archived:${id}`, "0");
      showToast("Moved to inbox");
      return;
    }
    try {
      setArchiving(true);
      if (id) await apiClient.post(`/emails/${id}/archive`);
      if (id) localStorage.setItem(`archived:${id}`, "1");
      setArchived(true);
      showToast("📦 Archived");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await apiClient.delete(`/emails/${id}`);
      showToast("🗑️ Deleted");
      setTimeout(() => navigate("/scheduled", { replace: true }), 600);
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Delete failed");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00A651] border-t-transparent" /></div>;
  if (!job) return <div className="p-8 text-center text-sm text-gray-500">Email not found</div>;

  const subject = job.subject || "(no subject)";
  const senderName = job.sender?.name || job.sender?.email?.split("@")[0] || "Unknown";
  const senderEmail = job.sender?.email || "sender@domain.io";
  const recipientEmail = job.recipientEmail || "";
  const initial = senderName.charAt(0).toUpperCase();
  const dateSource = job.status === "sent" || job.status === "failed" ? job.updatedAt : job.scheduledAt;
  const dateStr = new Date(dateSource).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  const scheduledStr = new Date(job.scheduledAt).toLocaleString();
  const body: string = job.body || "";
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);

  return (
    <div className="min-h-screen bg-white">
      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">Delete email?</h3>
            <p className="mt-1 text-sm text-gray-500">This will permanently delete "{subject}" to {recipientEmail}. This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar - matches show.png */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          <span className="truncate max-w-[480px]">{subject}</span>
        </button>
        <div className="flex items-center gap-1 text-gray-400">
          <span className="mr-2 hidden sm:inline-flex"><StatusBadge status={archived ? "archived" : job.status} /></span>
          <button
            onClick={handleStar}
            className={`rounded p-1.5 hover:bg-gray-100 ${starred ? "text-amber-400" : "text-gray-400"}`}
            title={starred ? "Unstar" : "Star"}
            aria-label="Star"
          >
            <svg className="h-4 w-4" fill={starred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </button>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className={`rounded p-1.5 hover:bg-gray-100 disabled:opacity-50 ${archived ? "text-[#00A651] bg-[#E8F5E9]" : "text-gray-400"}`}
            title={archived ? "Unarchive" : "Archive"}
            aria-label="Archive"
          >
            {archiving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent inline-block" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="rounded p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
            title="Delete"
            aria-label="Delete"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <img src={`https://i.pravatar.cc/100?u=${senderEmail}`} alt="me" className="h-7 w-7 rounded-full object-cover" />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-6">
        {/* Sender header - matches show.png */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00A651] text-sm font-medium text-white">{initial}</div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900">{senderName}</span>
                <span className="text-xs text-gray-500">&lt;{senderEmail}&gt;</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>to {recipientEmail}</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">{dateStr}</div>
            <div className="mt-1 flex justify-end gap-1">
              {starred && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">★ Starred</span>}
              {archived && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-200">Archived</span>}
              <StatusBadge status={job.status} />
            </div>
          </div>
        </div>

        {/* Subject line */}
        <h2 className="mb-4 text-base font-semibold text-gray-900">{subject}</h2>

        {/* Body - dynamic per email, keeps show.png typography */}
        <div className="text-sm leading-relaxed text-gray-800">
          {isHtml ? (
            <div className="prose prose-sm max-w-none prose-p:my-2 prose-a:text-[#00A651]" dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <div className="whitespace-pre-wrap break-words">{body || <span className="text-gray-400 italic">No content</span>}</div>
          )}
        </div>

        {/* Meta footer */}
        <div className="mt-8 rounded-lg border bg-[#FAFBFA] p-4">
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div><span className="font-medium text-gray-600">Recipient:</span> <span className="text-gray-900">{recipientEmail}</span></div>
            <div><span className="font-medium text-gray-600">Sender ID:</span> <span className="text-gray-900">{job.senderId?.slice(0, 12)}…</span></div>
            <div><span className="font-medium text-gray-600">Scheduled:</span> <span className="text-gray-900">{scheduledStr}</span></div>
            <div><span className="font-medium text-gray-600">Status:</span> <span className="capitalize text-gray-900">{job.status}</span> {job.bullJobId && <span className="text-gray-400">• {job.bullJobId.slice(0, 8)}</span>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
