import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function fmtDate(s) {
  if (!s) return "-";
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
function fmtDuration(sec) {
  if (!sec) return "0초";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

export default function Admin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    const { data, error } = await supabase.rpc("admin_list_members");
    if (error) setErr(error.message);
    else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function withdraw(row) {
    const next = row.status === "withdrawn" ? "active" : "withdrawn";
    if (!confirm(next === "withdrawn" ? `${row.username || row.email} 회원을 탈퇴 처리할까요?` : "이 회원을 복구할까요?")) return;
    const { error } = await supabase.rpc("admin_set_status", { target: row.id, new_status: next });
    if (error) alert("실패: " + error.message);
    else load();
  }

  const totalMembers = rows.length;
  const totalGenerations = rows.reduce((a, r) => a + Number(r.generation_count || 0), 0);
  const totalDuration = rows.reduce((a, r) => a + Number(r.total_duration || 0), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">관리자 대시보드</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="가입 회원" value={`${totalMembers}명`} />
        <Stat label="총 생성 횟수" value={`${totalGenerations}건`} />
        <Stat label="총 사용 시간 (생성 음성 길이)" value={fmtDuration(totalDuration)} />
      </div>

      <section className="rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-700">회원 목록</h2>
          <button onClick={load} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
            새로고침
          </button>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-400">불러오는 중…</p>
        ) : err ? (
          <p className="p-5 text-sm text-red-500">불러오기 실패: {err}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 font-medium">아이디</th>
                  <th className="px-4 py-3 font-medium">이메일</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                  <th className="px-4 py-3 font-medium">최근 로그인</th>
                  <th className="px-4 py-3 font-medium">생성 수</th>
                  <th className="px-4 py-3 font-medium">사용 시간</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{r.username || "-"}{r.is_admin && <span className="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-600">관리자</span>}</td>
                    <td className="px-4 py-3 text-slate-500">{r.email}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.last_login)}</td>
                    <td className="px-4 py-3">{r.generation_count || 0}</td>
                    <td className="px-4 py-3">{fmtDuration(r.total_duration)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "withdrawn" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                        {r.status === "withdrawn" ? "탈퇴" : "활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!r.is_admin && (
                        <button onClick={() => withdraw(r)} className="text-xs font-medium text-slate-500 hover:text-red-600">
                          {r.status === "withdrawn" ? "복구" : "탈퇴"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">회원이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
