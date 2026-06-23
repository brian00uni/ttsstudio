import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { recordVisit } from "../lib/visits";

function VisitCounter() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let alive = true;
    recordVisit()
      .then((c) => { if (alive) setCounts(c); })
      .catch(() => { /* counter is optional; ignore if schema not applied */ });
    return () => { alive = false; };
  }, []);

  const fmt = (n) => (counts ? n.toLocaleString() : "—");

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <span>👣</span> 사이트 방문
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>전체</span>
        <span className="font-semibold tabular-nums text-slate-700">{fmt(counts?.total)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
        <span>오늘</span>
        <span className="font-semibold tabular-nums text-brand-600">{fmt(counts?.today)}</span>
      </div>
    </div>
  );
}

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  );
}

function ProfileMenu() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const name = profile?.username || user?.email?.split("@")[0] || "사용자";
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(path) { setOpen(false); navigate(path); }
  async function handleSignOut() { setOpen(false); await signOut(); navigate("/login", { replace: true }); }

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button onClick={() => go("/account")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <span>👤</span> 계정관리
          </button>
          <button onClick={() => go("/history")} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <span>🗂️</span> TTS 생성 내역
          </button>
          <div className="border-t border-slate-100" />
          <button onClick={handleSignOut} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <span>↩️</span> 로그아웃
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">{name}</span>
          <span className="block truncate text-xs text-slate-400">{user?.email}</span>
        </span>
        <span className="text-slate-400">›</span>
      </button>
    </div>
  );
}

export default function AppShell({ children }) {
  const { isAdmin } = useAuth();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-xl">🎙️</span>
          <span className="text-lg font-bold tracking-tight">ttsstudio</span>
        </div>
        <nav className="flex flex-col gap-1">
          {isAdmin && <NavItem to="/admin" label="관리자 대시보드" icon="📊" />}
          <NavItem to="/studio" label="음성 생성" icon="🔊" />
          <NavItem to="/history" label="TTS 생성 내역" icon="🗂️" />
        </nav>
        <div className="mt-auto pt-4">
          <ProfileMenu />
          <div className="mt-2">
            <VisitCounter />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="text-sm font-bold md:hidden">🎙️ ttsstudio</div>
          <div className="ml-auto flex items-center gap-2">
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
          </div>
        </header>
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
