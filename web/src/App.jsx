import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext.jsx";
import AppShell from "./components/AppShell.jsx";
import Login from "./pages/Login.jsx";
import Studio from "./pages/Studio.jsx";
import Account from "./pages/Account.jsx";
import History from "./pages/History.jsx";
import Admin from "./pages/Admin.jsx";

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      불러오는 중…
    </div>
  );
}

// Requires a logged-in user; optionally requires admin.
function Protected({ children, adminOnly }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { user, isAdmin, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Loading /> : user ? <Navigate to="/" replace /> : <Login />}
      />
      {/* Home: admins land on the dashboard, users on the studio. */}
      <Route
        path="/"
        element={
          loading ? <Loading /> : !user ? (
            <Navigate to="/login" replace />
          ) : isAdmin ? (
            <Navigate to="/admin" replace />
          ) : (
            <Navigate to="/studio" replace />
          )
        }
      />
      <Route path="/studio" element={<Protected><Studio /></Protected>} />
      <Route path="/account" element={<Protected><Account /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      {/* legacy path */}
      <Route path="/settings" element={<Navigate to="/account" replace />} />
      <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
