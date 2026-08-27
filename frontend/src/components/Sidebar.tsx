import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface Props {
  scheduledCount?: number;
  sentCount?: number;
}

export default function Sidebar({ scheduledCount = 0, sentCount = 0 }: Props) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isScheduled = location.pathname === "/scheduled" || location.pathname === "/dashboard";
  const isSent = location.pathname === "/sent";

  const displayName = user?.name || "Oliver Brown";
  const displayEmail = user?.email || "oliver.brown@domain.io";
  const avatar = user?.avatarUrl || `https://i.pravatar.cc/100?u=${displayEmail}`;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r bg-white px-3 py-4">
      {/* Logo */}
      <div className="px-2 pb-4">
        <Link to="/scheduled" className="flex items-center gap-1">
          <span className="text-[28px] font-black tracking-tighter leading-none">ONB</span>
        </Link>
      </div>

      {/* User card */}
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#F8FAF8] px-3 py-3">
        <img src={avatar} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-xs font-semibold leading-none text-gray-900">{displayName}</p>
          <p className="truncate text-[11px] text-gray-500">{displayEmail}</p>
        </div>
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>

      {/* Compose */}
      <button
        onClick={() => navigate("/compose")}
        className="mb-6 flex w-full items-center justify-center rounded-full border border-[#00A651] bg-white px-4 py-2 text-sm font-medium text-[#00A651] hover:bg-[#E8F5E9] transition"
      >
        Compose
      </button>

      {/* CORE */}
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-gray-400">CORE</p>

        <Link
          to="/scheduled"
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${isScheduled ? "bg-[#E8F5E9] font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
        >
          <span className="flex items-center gap-2.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Scheduled
          </span>
          <span className={`text-xs ${isScheduled ? "text-gray-600" : "text-gray-400"}`}>{scheduledCount}</span>
        </Link>

        <Link
          to="/sent"
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${isSent ? "bg-[#E8F5E9] font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
        >
          <span className="flex items-center gap-2.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Sent
          </span>
          <span className={`text-xs ${isSent ? "text-gray-600" : "text-gray-400"}`}>{sentCount}</span>
        </Link>
      </div>

      <div className="flex-1" />
      <button
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
        className="mx-2 mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        Logout
      </button>
    </aside>
  );
}
