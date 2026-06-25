import { useEffect, useState, useCallback } from "react";
import { listGenerationsPage, signedUrl, deleteGeneration } from "../lib/library";
import { voiceImg, voiceName } from "../lib/tts";

const PAGE_SIZE = 20;

function fmtDate(s) {
  if (!s) return "-";
  const d = new Date(s);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtDuration(sec) {
  return sec != null ? `${Number(sec).toFixed(1)}초` : "-";
}
function truncate(t) {
  const s = t || "";
  return s.length > 10 ? s.slice(0, 10) + "…" : s || "(내용 없음)";
}

async function downloadAudio(row, url) {
  // Supabase signed URLs are cross-origin, so the <a download> attribute is
  // ignored by browsers (it would open the file instead). Fetch the bytes and
  // download via a blob URL to force a real download with our filename.
  if (!url) return;
  const blob = await (await fetch(url)).blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = (row.audio_path || "audio.mp3").split("/").pop();
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(objUrl);
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
  const [selected, setSelected] = useState(null);

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
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
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
                  <tr key={r.id} onClick={() => setSelected(r)}
                    className="cursor-pointer border-t border-slate-50 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3" title={r.text}>{truncate(r.text)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDuration(r.duration)}</td>
                    <td className="px-4 py-3 text-center">
                      {audioUrls[r.id] ? (
                        <button onClick={(e) => { e.stopPropagation(); downloadAudio(r, audioUrls[r.id]); }} title="오디오 다운로드"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                          ⬇ MP3
                        </button>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.srt_text ? (
                        <button onClick={(e) => { e.stopPropagation(); downloadSrt(r); }} title="SRT 다운로드"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                          ⬇ SRT
                        </button>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); remove(r); }} title="삭제"
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
              className={`min-w-8 rounded-lg px-3 py-1.5 text-sm ${i === page ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {i + 1}
            </button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40">›</button>
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setSelected(null)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-sm font-bold text-slate-800">상세보기</h3>
              <button onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {selected.voice && voiceImg(selected.voice) && (
                <div className="mb-3 flex items-center gap-2">
                  <img src={voiceImg(selected.voice)} alt={voiceName(selected.voice)}
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200" />
                  <span className="text-sm font-semibold text-slate-800">{voiceName(selected.voice)}</span>
                </div>
              )}
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>{fmtDate(selected.created_at)}</span>
                {selected.lang && <span>언어: {selected.lang}</span>}
                <span>길이: {fmtDuration(selected.duration)}</span>
              </div>

              {audioUrls[selected.id] && (
                <audio controls autoPlay src={audioUrls[selected.id]} className="mb-4 w-full" />
              )}

              <div className="mb-1 text-xs font-semibold text-slate-500">내용</div>
              <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {selected.text || "(내용 없음)"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
              {audioUrls[selected.id] && (
                <button onClick={() => downloadAudio(selected, audioUrls[selected.id])}
                  className="rounded-lg bg-secondary-600 px-4 py-2 text-sm font-medium text-white hover:bg-secondary-700">
                  MP3 다운로드
                </button>
              )}
              {selected.srt_text && (
                <button onClick={() => downloadSrt(selected)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                  자막(SRT)
                </button>
              )}
              <button onClick={() => { const r = selected; setSelected(null); remove(r); }}
                className="ml-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
