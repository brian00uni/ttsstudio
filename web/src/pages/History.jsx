import { useEffect, useState } from "react";
import { listMyGenerations, signedUrl, deleteGeneration } from "../lib/library";

function fmtDate(s) {
  return s ? new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-";
}

export default function History() {
  const [rows, setRows] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const data = await listMyGenerations(100);
      setRows(data);
      const map = {};
      await Promise.all(data.map(async (r) => { map[r.id] = await signedUrl(r.audio_path); }));
      setUrls(map);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function remove(row) {
    if (!confirm("이 음성을 삭제할까요?")) return;
    await deleteGeneration(row);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">TTS 생성 내역</h1>
        <button onClick={load} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : err ? (
        <p className="text-sm text-red-500">불러오기 실패: {err}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          아직 생성한 음성이 없습니다. 음성을 생성하면 여기에 자동 저장됩니다.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-2 text-sm text-slate-700">{r.text || "(제목 없음)"}</p>
                <button onClick={() => remove(r)} className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-600">
                  삭제
                </button>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {[r.voice, r.lang, r.duration ? `${r.duration.toFixed(1)}초` : null, fmtDate(r.created_at)]
                  .filter(Boolean).join(" · ")}
              </div>
              {urls[r.id] && (
                <div className="mt-2 flex items-center gap-2">
                  <audio controls src={urls[r.id]} className="h-9 flex-1" />
                  <a href={urls[r.id]} download className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                    다운로드
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
