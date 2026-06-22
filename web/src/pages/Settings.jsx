import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext.jsx";

export default function Settings() {
  const { user, profile } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    setMsg(""); setOk(false);
    if (pw.length < 6) { setMsg("비밀번호는 6자 이상이어야 합니다."); return; }
    if (pw !== pw2) { setMsg("비밀번호가 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOk(true); setMsg("비밀번호가 변경되었습니다."); setPw(""); setPw2("");
    } catch (err) {
      setMsg(err.message || String(err));
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-xl font-bold">설정</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">계정 정보</h2>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-slate-400">아이디</dt>
          <dd className="col-span-2">{profile?.username || "-"}</dd>
          <dt className="text-slate-400">이메일</dt>
          <dd className="col-span-2">{user?.email}</dd>
          <dt className="text-slate-400">권한</dt>
          <dd className="col-span-2">{profile?.is_admin ? "관리자" : "일반 회원"}</dd>
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">비밀번호 변경</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password" placeholder="새 비밀번호 (6자 이상)"
            value={pw} onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          <input
            type="password" placeholder="새 비밀번호 확인"
            value={pw2} onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          <button disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
        {msg && <p className={`mt-3 text-xs ${ok ? "text-green-600" : "text-red-500"}`}>{msg}</p>}
      </section>
    </div>
  );
}
