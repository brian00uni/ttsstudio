import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const { profile, user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.username || user?.email || "사용자";

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-xl">🎙️</span>
          <span className="text-lg font-bold tracking-tight">ttsstudio</span>
        </div>
        <nav className="flex flex-col gap-1">
          {isAdmin && <NavItem to="/admin" label="관리자 대시보드" icon="📊" />}
          <NavItem to="/studio" label="음성 생성" icon="🔊" />
          <NavItem to="/settings" label="설정" icon="⚙️" />
        </nav>
        <div className="mt-auto px-2 pt-4 text-xs text-slate-400">
          {isAdmin ? "관리자" : "일반 회원"}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="text-sm text-slate-500 md:hidden font-bold">🎙️ ttsstudio</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">{name}</span>
            {isAdmin && (
              <a
                href="/legacy"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                구버전 화면
              </a>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              로그아웃
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
