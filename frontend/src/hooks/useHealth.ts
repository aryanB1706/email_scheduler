import { useEffect, useState } from "react";
import { fetchHealth } from "../api/health";
import type { HealthResponse } from "../types";

export function useHealth(pollMs = 0) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchHealth();
        if (mounted) {
          setData(res);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to fetch health");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    if (pollMs > 0) {
      const id = setInterval(load, pollMs);
      return () => {
        mounted = false;
        clearInterval(id);
      };
    }
    return () => {
      mounted = false;
    };
  }, [pollMs]);

  return { data, loading, error };
}
