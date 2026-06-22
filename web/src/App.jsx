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

// Shown to withdrawn accounts; blocks app access and logs them out.
function WithdrawnNotice() {
  const { signOut } = useAuth();
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="text-3xl">🚪</div>
        <h2 className="mt-3 text-lg font-bold">탈퇴한 계정입니다</h2>
        <p className="mt-2 text-sm text-slate-500">이 계정은 탈퇴 처리되어 이용할 수 없습니다.</p>
        <button onClick={signOut} className="mt-5 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          로그아웃
        </button>
      </div>
    </div>
  );
}

// Requires a logged-in user; optionally requires admin.
function Protected({ children, adminOnly }) {
  const { user, isAdmin, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.status === "withdrawn") return <WithdrawnNotice />;
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
