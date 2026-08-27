import { useState, useEffect } from "react";
import Modal from "./Modal";
import Input, { Textarea } from "./Input";
import Button from "./Button";
import Badge from "./Badge";
import { parseRecipients } from "../api/parse";
import { scheduleEmails } from "../api/emails";
import type { Sender } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  senders: Sender[];
}

export default function ComposeModal({ open, onClose, onScheduled, senders }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ count: number; validEmails: string[] } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [delayMs, setDelayMs] = useState(1000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [senderId, setSenderId] = useState(senders[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (senders.length && !senderId) setSenderId(senders[0].id);
  }, [senders, senderId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    if (!file) return;
    try {
      setParsing(true);
      const res = await parseRecipients(file);
      setParsed({ count: res.count, validEmails: res.validEmails });
      // Merge parsed emails into textarea (dedupe)
      const existing = recipientsText
        .split(/[,\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...existing, ...res.validEmails])).join(", ");
      setRecipientsText(merged);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  const handleSchedule = async () => {
    setError(null);
    setResult(null);
    const recipients = recipientsText
      .split(/[,\n;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!subject || !body || recipients.length === 0 || !senderId) {
      setError("Subject, body, recipients and sender are required");
      return;
    }

    try {
      setLoading(true);
      const iso = new Date(scheduledAt).toISOString();
      const res = await scheduleEmails({
        subject,
        body,
        recipients,
        scheduledAt: iso,
        delayBetweenEmailsMs: delayMs,
        maxEmailsPerHour: hourlyLimit,
        senderId,
      });
      setResult(`${res.message} — ${res.jobs.length} jobs created`);
      onScheduled();
      // Don't auto-close immediately so user sees result; close after 1s
      setTimeout(() => {
        onClose();
        setResult(null);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.details || err.message || "Schedule failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Compose & Schedule">
      <div className="space-y-4">
        {senders.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Sender</label>
            <select value={senderId} onChange={(e) => setSenderId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ? `${s.name} <${s.email}>` : s.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Input label="Sender ID (create via POST /api/senders if empty)" value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="cuid" />
        )}

        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Welcome to our platform" />
        <Textarea label="Body (supports HTML)" value={body} onChange={(e) => setBody(e.target.value)} placeholder="<h1>Hello</h1><p>...</p>" rows={4} />

        <div className="rounded-lg border border-dashed p-3">
          <label className="text-sm font-medium">Recipients</label>
          <Textarea
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder="Comma-separated: alice@example.com, bob@example.com"
            rows={3}
            className="mt-1"
          />
          <div className="mt-2 flex items-center gap-3">
            <label className="text-sm">
              <span className="mr-2">Or upload CSV/TXT:</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileChange} className="text-sm" />
            </label>
            {parsing && <span className="text-xs text-gray-500">Parsing...</span>}
            {parsed && (
              <span className="text-xs">
                <Badge status="default" /> {parsed.count} valid emails parsed
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          <Input label="Delay between (ms)" type="number" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} />
        </div>
        <Input label="Hourly limit (per sender)" type="number" value={hourlyLimit} onChange={(e) => setHourlyLimit(Number(e.target.value))} />

        {csvFile && <div className="text-xs text-gray-500">Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)</div>}

        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {result && <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{result}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} loading={loading}>
            Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
