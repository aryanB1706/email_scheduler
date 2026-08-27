import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import ComposePage from "./pages/ComposePage";
import EmailDetail from "./pages/EmailDetail";

function AppRoutes() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/auth/callback";
  const isAppShellPage = ["/scheduled", "/sent", "/compose"].some(p => location.pathname.startsWith(p)) || location.pathname.startsWith("/email/") || location.pathname === "/dashboard";

  // For shell pages, don't wrap with Layout header
  if (isAppShellPage || isAuthPage) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Navigate to="/scheduled" replace />} />
        <Route path="/scheduled" element={<ProtectedRoute><Dashboard initialTab="scheduled" /></ProtectedRoute>} />
        <Route path="/sent" element={<ProtectedRoute><Dashboard initialTab="sent" /></ProtectedRoute>} />
        <Route path="/compose" element={<ProtectedRoute><ComposePage /></ProtectedRoute>} />
        <Route path="/email/:id" element={<ProtectedRoute><EmailDetail /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Navigate to="/scheduled" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
