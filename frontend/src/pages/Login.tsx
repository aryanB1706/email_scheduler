import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { devLogin } from "../api/auth";

export default function Login() {
  const { user, loading, login, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devLoading, setDevLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate("/scheduled", { replace: true });
  }, [user, loading, navigate]);

  const handleGoogle = () => login();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter email");
      return;
    }
    try {
      setDevLoading(true);
      setError(null);
      await devLogin(email || "dev@example.com");
      await refresh();
      navigate("/scheduled", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed. Is ALLOW_DEV_LOGIN=true?");
    } finally {
      setDevLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-gray-900">Login</h1>

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8F5E9] px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-[#DFF0E3] transition"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" className="h-4 w-4" />
          Login with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or sign up through email</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-[#F3F5F3] px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 border border-transparent focus:border-green-500/30"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-[#F3F5F3] px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 border border-transparent focus:border-green-500/30"
          />

          {error && <p className="text-xs text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={devLoading}
            className="mt-2 w-full rounded-lg bg-[#00A651] px-4 py-3 text-sm font-medium text-white hover:bg-[#009246] transition disabled:opacity-50 flex items-center justify-center"
          >
            {devLoading && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            Login
          </button>
        </form>

        {/* dev bypass hidden but still accessible */}
        <p className="mt-6 text-center text-[11px] text-gray-400">
          For local dev without Google, enter any email and click Login
        </p>
      </div>
    </div>
  );
}
