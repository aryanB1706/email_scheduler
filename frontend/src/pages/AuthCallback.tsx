import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");

    if (err) {
      setError(`OAuth failed: ${err}`);
      return;
    }

    if (token) {
      localStorage.setItem("token", token);
      // Verify token by fetching me
      refresh().then(() => navigate("/scheduled", { replace: true }));
    } else {
      // Maybe cookie already set (backend set httpOnly) — try refresh
      refresh().then(() => {
        const t = localStorage.getItem("token");
        if (t) navigate("/scheduled", { replace: true });
        else setError("No token received from OAuth callback");
      });
    }
  }, [navigate, refresh]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#00A651] border-t-transparent" />
        <p className="mt-3 text-sm text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  );
}
