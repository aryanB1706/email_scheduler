import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Button from "./Button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            ✉️ Email Scheduler
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="hover:underline">
              Home
            </Link>
            {user ? (
              <>
                <Link to="/dashboard" className="hover:underline">
                  Dashboard
                </Link>
                <div className="flex items-center gap-3 border-l pl-4">
                  {user.avatarUrl && <img src={user.avatarUrl} alt={user.name || "avatar"} className="h-8 w-8 rounded-full" />}
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <Link to="/login" className="rounded-full border border-[#00A651] bg-white px-4 py-1.5 text-sm font-medium text-[#00A651] hover:bg-[#E8F5E9]">
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
