import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { parseRecipients } from "../api/parse";
import { scheduleEmails } from "../api/emails";
import type { Sender } from "../types";

export default function ComposePage() {
  const navigate = useNavigate();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState("");
  const [hourly, setHourly] = useState("");
  const [showSendLater, setShowSendLater] = useState(false);
  const [pickDate, setPickDate] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    apiClient.get("/senders").then((r) => {
      const data = r.data.data || r.data;
      if (Array.isArray(data) && data.length) {
        setSenders(data);
        setFrom(data[0].id);
      }
    }).catch(() => {});
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    if (!file) return;
    try {
      setParsing(true);
      const res = await parseRecipients(file);
      const merged = Array.from(new Set([...to.split(/[,\n;]+/).map(s=>s.trim()).filter(Boolean), ...res.validEmails])).join(", ");
      setTo(merged);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to parse CSV");
    } finally { setParsing(false); }
  };

  const getQuickDate = (label: string) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (label === "Tomorrow") {
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
    if (label === "Tomorrow, 10:00 AM") { tomorrow.setHours(10,0,0,0); return tomorrow; }
    if (label === "Tomorrow, 11:00 AM") { tomorrow.setHours(11,0,0,0); return tomorrow; }
    if (label === "Tomorrow, 3:00 PM") { tomorrow.setHours(15,0,0,0); return tomorrow; }
    return tomorrow;
  };

  const handleSend = async (useSchedule: boolean) => {
    setError(null);
    setSuccess(null);
    const recipients = to.split(/[,\n;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    if (!from || recipients.length===0 || !subject || !body) {
      setError("From, To, Subject and Body are required");
      return;
    }
    try {
      setLoading(true);
      let iso: string;
      if (useSchedule && scheduledAt) iso = new Date(scheduledAt).toISOString();
      else if (useSchedule && pickDate) iso = new Date(pickDate).toISOString();
      else if (scheduledAt) iso = new Date(scheduledAt).toISOString();
      else iso = new Date(Date.now() + 60*1000).toISOString(); // default 1 min later if immediate

      // If user clicked Send without Send Later, send now (use now + 5sec)
      if (!useSchedule) iso = new Date(Date.now() + 5000).toISOString();

      const res = await scheduleEmails({
        subject,
        body,
        recipients,
        scheduledAt: iso,
        delayBetweenEmailsMs: delay ? Number(delay) : 0,
        maxEmailsPerHour: hourly ? Number(hourly) : 100,
        senderId: from,
      });
      setSuccess(`${res.message} — ${res.jobs.length} jobs created`);
      setTimeout(()=> navigate("/scheduled"), 1000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.details || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Compose New Email
        </button>
        <div className="flex items-center gap-3">
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>
          <div className="relative">
            <button onClick={() => setShowSendLater(v=>!v)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            {showSendLater && (
              <div className="absolute right-0 top-8 z-20 w-72 rounded-xl border bg-white p-4 shadow-xl">
                <p className="mb-3 text-sm font-medium">Send Later</p>
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-gray-500">Pick date & time</label>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <input type="datetime-local" value={pickDate} onChange={e=>setPickDate(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                </div>
                <div className="space-y-1 border-t pt-2">
                  {["Tomorrow", "Tomorrow, 10:00 AM", "Tomorrow, 11:00 AM", "Tomorrow, 3:00 PM"].map(opt=>(
                    <button key={opt} onClick={()=>{
                      const d = getQuickDate(opt);
                      const iso = d.toISOString().slice(0,16);
                      setPickDate(iso);
                      setScheduledAt(d.toISOString());
                    }} className="block w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded">
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={()=>setShowSendLater(false)} className="px-4 py-1.5 text-sm font-medium hover:bg-gray-50 rounded-full">Cancel</button>
                  <button onClick={()=>{
                    if(pickDate) setScheduledAt(new Date(pickDate).toISOString());
                    setShowSendLater(false);
                  }} className="rounded-full border border-[#00A651] px-5 py-1.5 text-sm font-medium text-[#00A651] hover:bg-[#E8F5E9]">Done</button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={()=>handleSend(!!scheduledAt || !!pickDate)}
            disabled={loading}
            className="rounded-full border border-[#00A651] bg-white px-6 py-1.5 text-sm font-medium text-[#00A651] hover:bg-[#E8F5E9] disabled:opacity-50"
          >
            {loading ? "Sending..." : scheduledAt ? "Schedule" : "Send"}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="space-y-4">
          {/* From */}
          <div className="flex items-center gap-3 border-b pb-3">
            <label className="w-32 text-sm text-gray-500">From</label>
            <select value={from} onChange={e=>setFrom(e.target.value)} className="rounded-lg border bg-white px-3 py-1.5 text-sm min-w-[220px]">
              {senders.length ? senders.map(s=>(
                <option key={s.id} value={s.id}>{s.email}</option>
              )) : <option value={from}>{from || "select sender"}</option>}
            </select>
            {senders.length===0 && <input placeholder="sender cuid" value={from} onChange={e=>setFrom(e.target.value)} className="rounded border px-2 py-1 text-xs flex-1" />}
          </div>

          {/* To */}
          <div className="flex items-center gap-3 border-b pb-3">
            <label className="w-32 text-sm text-gray-500">To</label>
            <input value={to} onChange={e=>setTo(e.target.value)} placeholder="recipient@example.com" className="flex-1 py-1 text-sm placeholder:text-gray-400 focus:outline-none" />
            <label className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              CSV
            </label>
          </div>
          {parsing && <p className="text-xs text-gray-500 ml-36 -mt-2">Parsing CSV...</p>}
          {csvFile && <p className="text-xs text-gray-500 ml-36 -mt-2">{csvFile.name} ({(csvFile.size/1024).toFixed(1)} KB)</p>}

          {/* Subject */}
          <div className="flex items-center gap-3 border-b pb-3">
            <label className="w-32 text-sm text-gray-500">Subject</label>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" className="flex-1 py-1 text-sm placeholder:text-gray-400 focus:outline-none" />
          </div>

          {/* Delay / Hourly */}
          <div className="flex items-center gap-6 border-b pb-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 whitespace-nowrap">Delay between 2 emails</label>
              <input type="number" value={delay} onChange={e=>setDelay(e.target.value)} placeholder="00" className="w-16 rounded-lg border px-3 py-1.5 text-sm text-center" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 whitespace-nowrap">Hourly Limit</label>
              <input type="number" value={hourly} onChange={e=>setHourly(e.target.value)} placeholder="00" className="w-16 rounded-lg border px-3 py-1.5 text-sm text-center" />
            </div>
            {scheduledAt && <span className="text-xs text-[#00A651] bg-[#E8F5E9] px-2 py-1 rounded-full">Scheduled: {new Date(scheduledAt).toLocaleString()}</span>}
          </div>

          {/* Editor */}
          <div className="rounded-2xl bg-[#F8FAF8] p-4 min-h-[380px] flex flex-col">
            <textarea
              value={body}
              onChange={e=>setBody(e.target.value)}
              placeholder="Type Your Reply..."
              className="flex-1 w-full bg-transparent text-sm placeholder:text-gray-400 focus:outline-none resize-none min-h-[300px]"
            />

            {/* Toolbar */}
            <div className="mt-4 flex flex-wrap items-center gap-1 rounded-full bg-white px-3 py-2 shadow-sm border w-fit">
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg></button>
              <span className="mx-1 h-4 w-px bg-gray-200" />
              <button type="button" className="rounded px-1.5 py-1 text-xs font-medium hover:bg-gray-100">T<span className="text-[8px] align-super">t</span></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 font-bold text-sm">B</button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 italic text-sm">I</button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 underline text-sm">U</button>
              <span className="mx-1 h-4 w-px bg-gray-200" />
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3M21 12H11" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12h.01M12 16h.01M12 8h.01" /></svg></button>

              <span className="mx-1 h-4 w-px bg-gray-200" />
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4M7 16h10" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M11 5a2 2 0 012 2v3M11 5a2 2 0 002 2h3" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
              <button type="button" className="rounded p-1.5 hover:bg-gray-100 text-gray-500"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M13.828 10.172l4 4a4 4 0 005.656-5.656l-1.102 1.101" /></svg></button>
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>}
        </div>
      </div>
    </div>
  );
}
