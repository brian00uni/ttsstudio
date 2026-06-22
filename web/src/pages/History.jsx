import { useEffect, useState, useCallback } from "react";
import { listGenerationsPage, signedUrl, deleteGeneration } from "../lib/library";

const PAGE_SIZE = 20;

function fmtDate(s) {
  if (!s) return "-";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(s) {
  if (!s) return "-";
  return new Date(s).toLocaleTimeString("ko-KR", { hour12: false });
}
function truncate(t) {
  const s = t || "";
  return s.length > 10 ? s.slice(0, 10) + "…" : s || "(내용 없음)";
}

function downloadSrt(row) {
  const blob = new Blob([row.srt_text || ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = (row.audio_path || "subtitle").split("/").pop().replace(/\.\w+$/, "");
  a.href = url; a.download = `${base}.srt`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function History() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [audioUrls, setAudioUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (p) => {
    setLoading(true); setErr("");
    try {
      const { rows, count } = await listGenerationsPage(p, PAGE_SIZE);
      setRows(rows); setCount(count);
      const map = {};
      await Promise.all(rows.map(async (r) => { map[r.id] = await signedUrl(r.audio_path); }));
      setAudioUrls(map);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  async function remove(row) {
    if (!confirm("이 음성을 삭제할까요?")) return;
    await deleteGeneration(row);
    // if last item on a page was removed, step back a page
    if (rows.length === 1 && page > 0) setPage((p) => p - 1);
    else load(page);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">TTS 생성 내역</h1>
        <button onClick={() => load(page)} title="새로고침"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={loading ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          새로고침
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">내용</th>
                <th className="px-4 py-3 font-medium">생성시간</th>
                <th className="px-4 py-3 font-medium text-center">오디오</th>
                <th className="px-4 py-3 font-medium text-center">SRT</th>
                <th className="px-4 py-3 font-medium text-center">삭제</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">불러오는 중…</td></tr>
              ) : err ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-red-500">불러오기 실패: {err}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">아직 생성한 음성이 없습니다.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3" title={r.text}>{truncate(r.text)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtTime(r.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      {audioUrls[r.id] ? (
                        <a href={audioUrls[r.id]} download title="오디오 다운로드"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                          ⬇ MP3
                        </a>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.srt_text ? (
                        <button onClick={() => downloadSrt(r)} title="SRT 다운로드"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                          ⬇ SRT
                        </button>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => remove(r)} title="삭제"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {count > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-1">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40">‹</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`min-w-8 rounded-lg px-3 py-1.5 text-sm ${i === page ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {i + 1}
            </button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  );
}
