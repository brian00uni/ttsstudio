import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext.jsx";

function fmtUsage(sec) {
  const s = Math.round(sec || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return { seconds: s, pretty: m > 0 ? `${m}분 ${rem}초` : `${rem}초` };
}

export default function Account() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isSharedUser = profile?.username === "user" || user?.email === "user@ttsstudio.app";

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const [usage, setUsage] = useState({ count: 0, duration: 0 });

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("generations")
      .select("duration")
      .then(({ data }) => {
        const rows = data || [];
        const duration = rows.reduce((a, r) => a + (r.duration || 0), 0);
        setUsage({ count: rows.length, duration });
      });
  }, [user?.id]);

  async function changePassword(e) {
    e.preventDefault();
    setMsg(""); setOk(false);
    if (isSharedUser) { setMsg("공용 계정은 비밀번호를 변경할 수 없습니다."); return; }
    if (pw.length < 6) { setMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    if (pw !== pw2) { setMsg("비밀번호가 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOk(true); setMsg("비밀번호가 변경되었습니다."); setPw(""); setPw2("");
    } catch (err) { setMsg(err.message || String(err)); }
    finally { setBusy(false); }
  }

  async function withdraw() {
    if (isSharedUser) return;
    if (!confirm("정말 회원탈퇴 하시겠어요?\n탈퇴 후에는 로그인할 수 없습니다.")) return;
    const { error } = await supabase.rpc("withdraw_self");
    if (error) { alert("탈퇴 실패: " + error.message); return; }
    await signOut();
    navigate("/login", { replace: true });
    alert("회원탈퇴가 완료되었습니다.");
  }

  const u = fmtUsage(usage.duration);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-xl font-bold">계정관리</h1>

      {/* 계정정보 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">계정정보</h2>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-slate-400">아이디</dt>
          <dd className="col-span-2">{profile?.username || "-"}</dd>
          <dt className="text-slate-400">이메일</dt>
          <dd className="col-span-2">{user?.email}</dd>
          <dt className="text-slate-400">권한</dt>
          <dd className="col-span-2">{profile?.is_admin ? "관리자" : "일반 회원"}</dd>
          <dt className="text-slate-400">가입일</dt>
          <dd className="col-span-2">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ko-KR") : "-"}</dd>
        </dl>
      </section>

      {/* TTS 사용량 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">TTS 사용량</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">생성 횟수</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{usage.count}건</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">사용 시간</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{u.seconds}초</div>
            <div className="text-xs text-slate-500">({u.pretty})</div>
          </div>
        </div>
      </section>

      {/* 비밀번호 변경 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">비밀번호 변경</h2>
        {isSharedUser ? (
          <p className="text-sm text-slate-500">
            공용 계정(<span className="font-medium">user</span>)은 비밀번호를 변경할 수 없습니다.
          </p>
        ) : (
          <>
            <form onSubmit={changePassword} className="space-y-3">
              <input type="password" placeholder="새 비밀번호 (6자 이상)" value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
              <input type="password" placeholder="새 비밀번호 확인" value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
              <button disabled={busy}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {busy ? "변경 중…" : "비밀번호 변경"}
              </button>
            </form>
            {msg && <p className={`mt-3 text-xs ${ok ? "text-green-600" : "text-red-500"}`}>{msg}</p>}
          </>
        )}
      </section>

      {/* 회원탈퇴 */}
      {!isSharedUser && !profile?.is_admin && (
        <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-red-600">회원탈퇴</h2>
          <p className="mb-3 text-xs text-slate-500">탈퇴하면 계정이 비활성화되어 로그인할 수 없습니다.</p>
          <button onClick={withdraw}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            회원탈퇴
          </button>
        </section>
      )}
    </div>
  );
}
