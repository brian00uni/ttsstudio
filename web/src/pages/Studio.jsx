import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { VOICES, sampleUrl, synthesize } from "../lib/tts";
import { saveGeneration } from "../lib/library";

export default function Studio() {
  const { user, profile } = useAuth();
  const isSharedUser = profile?.username === "user" || user?.email === "user@ttsstudio.app";
  const [showShareNotice, setShowShareNotice] = useState(false);

  // Notify shared-account users (once per session) that the library is shared.
  useEffect(() => {
    if (isSharedUser && !sessionStorage.getItem("tts_share_notice")) {
      setShowShareNotice(true);
      sessionStorage.setItem("tts_share_notice", "1");
    }
  }, [isSharedUser]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("F1");
  const [speed, setSpeed] = useState(1.05);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const sampleRef = useRef(null);

  function playSample() {
    const a = sampleRef.current;
    if (!a) return;
    a.src = sampleUrl(voice);
    a.play().catch(() => setStatus("샘플을 재생할 수 없습니다."));
  }

  async function generate() {
    if (!text.trim()) { setStatus("텍스트를 입력하세요."); return; }
    setBusy(true); setStatus("음성 생성 중… (처음엔 서버 깨우는 데 시간이 걸릴 수 있어요)"); setResult(null);
    const payload = { text: text.trim(), voice, lang: "ko", speed: Number(speed), total_step: 8 };
    try {
      const res = await synthesize(payload);
      setResult(res);
      setStatus("");
      if (user) {
        try { await saveGeneration(user.id, payload, res); setStatus("내 라이브러리에 저장됨 ✓"); }
        catch (e) { setStatus("생성 완료 (저장 실패: " + (e.message || e) + ")"); }
      }
    } catch (e) {
      setStatus("생성 실패: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const audioUrl = result?.mp3_url || result?.audio_url;
  const wavUrl = result?.wav_url;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* 공용 계정 안내 모달 */}
      {showShareNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-center text-3xl">👥</div>
            <h3 className="mt-3 text-center text-lg font-bold">공용 계정 안내</h3>
            <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
              공용 계정은 라이브러리가 공유됩니다.<br />
              개인별 저장이 필요하시면 회원가입하시면 됩니다.
            </p>
            <button
              onClick={() => setShowShareNotice(false)}
              className="mt-5 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 타이틀 영역 */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 p-8 text-center text-white shadow">
        <h1 className="text-2xl font-bold">AI 음성으로 콘텐츠를 만들어 보세요</h1>
      </div>

      {/* 입력단 영역 - 생성 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">입력</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="읽어줄 텍스트를 입력하세요."
          className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">{text.length}자</span>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "생성 중…" : "음성 생성"}
          </button>
        </div>
        {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
      </section>

      {/* 설정값 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">설정</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">목소리</label>
            <div className="flex gap-2">
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <button
                onClick={playSample}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                title="샘플 듣기"
              >
                ▶ 샘플
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">속도 ({speed.toFixed(2)}x)</label>
            <input
              type="range" min="0.7" max="2.0" step="0.05"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
        </div>
        <audio ref={sampleRef} className="hidden" />
      </section>

      {/* 출력단 영역 - 다운로드 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">출력</h2>
        {audioUrl ? (
          <div className="space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex gap-2">
              <a href={audioUrl} download className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                MP3 다운로드
              </a>
              {wavUrl && (
                <a href={wavUrl} download className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                  WAV 다운로드
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">생성된 음성이 여기에 표시됩니다.</p>
        )}
      </section>
    </div>
  );
}
