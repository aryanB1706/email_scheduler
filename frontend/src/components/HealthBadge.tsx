import { useHealth } from "../hooks/useHealth";

export default function HealthBadge() {
  const { data, loading, error } = useHealth();

  if (loading) return <span className="rounded bg-gray-200 px-3 py-1 text-sm">Checking…</span>;
  if (error) return <span className="rounded bg-red-100 px-3 py-1 text-sm text-red-700">API unreachable: {error}</span>;
  if (!data) return null;

  const ok = data.status === "ok";
  return (
    <div className={`rounded px-3 py-2 text-sm ${ok ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
      <span className="font-semibold">API {data.status}</span>
      <span className="ml-3 opacity-75">{new Date(data.timestamp).toLocaleString()}</span>
      <div className="mt-1 flex gap-3 text-xs">
        {Object.entries(data.checks).map(([k, v]) => (
          <span key={k}>
            {k}: <b>{v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
