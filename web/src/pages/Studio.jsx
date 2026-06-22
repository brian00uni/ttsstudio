import { useEffect, useRef, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useAuth } from "../lib/AuthContext.jsx";
import { VOICES, LANGS, SPEED_OPTS, STEP_OPTS, CHUNK_OPTS, SILENCE_OPTS, sampleUrl, synthesize } from "../lib/tts";

// A <select> whose options are presets; falls back to a "프리셋 외 값(custom)"
// option when the current value isn't one of the presets.
function PresetSelect({ label, value, options, onChange }) {
  const v = String(value);
  const known = options.some(([val]) => val === v);
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <select value={known ? v : "__custom__"}
        onChange={(e) => { if (e.target.value !== "__custom__") onChange(e.target.value); }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500">
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        {!known && <option value="__custom__">프리셋 외 값(custom): {v || "자동"}</option>}
      </select>
    </div>
  );
}
import { saveGeneration } from "../lib/library";

const TABS = [
  { id: "manual", label: "사용자 입력" },
  { id: "file", label: "로컬 TXT" },
  { id: "sample", label: "대본 가져오기" },
];

const PRESET_PREFIX = "ttsstudio-preset-";
const PRESET_LAST = "ttsstudio-preset-last";
const PRESET_SLOTS = ["1", "2", "3", "4", "5"];

export default function Studio() {
  const { user, profile } = useAuth();
  const isSharedUser = profile?.username === "user" || user?.email === "user@ttsstudio.app";
  const [showShareNotice, setShowShareNotice] = useState(false);

  const [tab, setTab] = useState("manual");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("F1");
  const [lang, setLang] = useState("ko");
  const [speed, setSpeed] = useState(1.05);
  const [totalStep, setTotalStep] = useState(8);
  const [maxChunk, setMaxChunk] = useState("");      // "" = auto
  const [silence, setSilence] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [lottie, setLottie] = useState("idle"); // idle | loading | success
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [samples, setSamples] = useState([]);
  const [sampleId, setSampleId] = useState("");
  // 대본 요청 (Script request)
  const [req, setReq] = useState({ topic: "", tone: "차분함", length: "3분", audience: "일반 청취자", expression_tag_mode: "none", notes: "" });
  const [reqMsg, setReqMsg] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  // 사용자 설정 (presets)
  const [slot, setSlot] = useState("1");
  const [slotStatus, setSlotStatus] = useState("");
  const [presetVer, setPresetVer] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sampleRef = useRef(null);
  const fileRef = useRef(null);

  function currentSettings() {
    return { voice, lang, speed, total_step: totalStep, max_chunk_length: maxChunk, silence_duration: silence };
  }
  function applySettings(s) {
    if (!s) return;
    if (s.voice) setVoice(s.voice);
    if (s.lang) setLang(s.lang);
    if (s.speed != null) setSpeed(Number(s.speed));
    if (s.total_step != null) setTotalStep(Number(s.total_step));
    setMaxChunk(s.max_chunk_length ?? "");
    if (s.silence_duration != null) setSilence(Number(s.silence_duration));
  }
  // Short "value(한글)" label for an option value, e.g. "1.15(경쾌함)".
  function optShort(opts, value) {
    const v = String(value ?? "");
    const found = opts.find(([val]) => val === v);
    if (!found) return v === "" ? "자동(auto)" : v;
    const lbl = found[1];
    if (lbl.includes(" - ")) {
      const [left, rest] = lbl.split(" - ");
      return `${left}(${rest.split("(")[0].trim()})`;
    }
    return lbl;
  }
  function summarize(s) {
    if (!s) return "";
    const langName = LANGS.find((l) => l.code === s.lang)?.name || s.lang;
    return `[${langName} / ${optShort(SPEED_OPTS, s.speed)} / ${optShort(CHUNK_OPTS, s.max_chunk_length)} / ${optShort(STEP_OPTS, s.total_step)} / ${optShort(SILENCE_OPTS, s.silence_duration)}]`;
  }

  // Status line for a slot: "저장됨 {date} [요약]" or "비어 있음".
  function statusFor(s) {
    const raw = localStorage.getItem(PRESET_PREFIX + s);
    if (!raw) return `설정 ${s}: 비어 있음`;
    try {
      const obj = JSON.parse(raw);
      const at = obj.saved_at ? new Date(obj.saved_at).toLocaleString("ko-KR") : "";
      return `설정 ${s}: 저장됨 ${at} ${summarize(obj.settings)}`;
    } catch { return `설정 ${s}: 저장됨`; }
  }
  function savePreset() {
    localStorage.setItem(PRESET_PREFIX + slot, JSON.stringify({ saved_at: new Date().toISOString(), settings: currentSettings() }));
    localStorage.setItem(PRESET_LAST, slot);
    setPresetVer((v) => v + 1);
    setSlotStatus(statusFor(slot));
  }
  function loadPreset() {
    const raw = localStorage.getItem(PRESET_PREFIX + slot);
    if (!raw) { setSlotStatus(`설정 ${slot}: 비어 있음`); return; }
    applySettings(JSON.parse(raw).settings);
    localStorage.setItem(PRESET_LAST, slot);
    setSlotStatus(statusFor(slot));
  }
  function clearPreset() {
    localStorage.removeItem(PRESET_PREFIX + slot);
    setPresetVer((v) => v + 1);
    setSlotStatus(`설정 ${slot}: 비어 있음`);
  }
  // Short label for the slot dropdown showing saved date or empty.
  function slotLabel(s) {
    const raw = localStorage.getItem(PRESET_PREFIX + s);
    if (!raw) return `설정 ${s} · 비어있음`;
    try {
      const at = JSON.parse(raw).saved_at;
      const d = at ? new Date(at) : null;
      const short = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "저장됨";
      return `설정 ${s} · ${short}`;
    } catch { return `설정 ${s} · 저장됨`; }
  }

  // Save a script-generation request to the backend (legacy 대본 요청).
  async function submitRequest() {
    if (!req.topic.trim()) { setReqMsg("주제를 먼저 입력하세요."); return; }
    setReqBusy(true); setReqMsg("대본 요청 저장 중…");
    try {
      const res = await fetch("/api/script-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req, language: lang }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReqMsg(`저장됨: ${data.request?.id || "완료"}`);
    } catch (e) {
      setReqMsg("저장 실패: " + (e.message || e));
    } finally { setReqBusy(false); }
  }

  // Show the selected slot's saved status whenever the slot changes.
  useEffect(() => { setSlotStatus(statusFor(slot)); }, [slot]);

  // Auto-load the last used preset on entry.
  useEffect(() => {
    const last = localStorage.getItem(PRESET_LAST);
    const raw = last && localStorage.getItem(PRESET_PREFIX + last);
    if (raw) { setSlot(last); applySettings(JSON.parse(raw).settings); }
  }, []);

  useEffect(() => {
    if (isSharedUser && !sessionStorage.getItem("tts_share_notice")) {
      setShowShareNotice(true);
      sessionStorage.setItem("tts_share_notice", "1");
    }
  }, [isSharedUser]);

  // Load sample scripts for "대본 가져오기".
  function loadSamples() {
    return fetch("/public/scripts.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSamples(d.scripts || []))
      .catch(() => setSamples([]));
  }
  useEffect(() => { loadSamples(); }, []);

  function toggleSample() {
    const a = sampleRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    a.src = sampleUrl(voice);
    a.play().then(() => setPlaying(true)).catch(() => setStatus("샘플을 재생할 수 없습니다."));
  }
  // Stop playback if the voice changes mid-play.
  useEffect(() => { const a = sampleRef.current; if (a) { a.pause(); setPlaying(false); } }, [voice]);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result || "")); setStatus(`'${file.name}' 불러옴`); };
    reader.onerror = () => setStatus("파일을 읽을 수 없습니다.");
    reader.readAsText(file, "utf-8");
  }

  async function onPickSample(e) {
    const id = e.target.value;
    setSampleId(id);
    const s = samples.find((x) => x.id === id);
    if (!s) return;
    if (s.voice && VOICES.some((v) => v.id === s.voice)) setVoice(s.voice);
    if (s.lang) setLang(s.lang);
    if (s.speed) setSpeed(Number(s.speed));
    if (s.total_step != null) setTotalStep(Number(s.total_step));
    if (s.max_chunk_length != null) setMaxChunk(s.max_chunk_length);
    if (s.silence_duration != null) setSilence(Number(s.silence_duration));
    // Some samples store text inline; others reference an external .txt (text_url).
    if (s.text) {
      setText(s.text);
      setStatus(`'${s.title}' 대본 불러옴`);
    } else if (s.text_url) {
      setStatus(`'${s.title}' 대본 불러오는 중…`);
      try {
        const t = await (await fetch(s.text_url, { cache: "no-store" })).text();
        setText(t);
        setStatus(`'${s.title}' 대본 불러옴`);
      } catch {
        setStatus("대본 파일을 불러올 수 없습니다.");
      }
    }
  }

  async function generate() {
    if (!text.trim()) { setStatus("텍스트를 입력하세요."); return; }
    setBusy(true); setLottie("loading"); setStatus("음성 생성 중… (처음엔 서버 깨우는 데 시간이 걸릴 수 있어요)"); setResult(null);
    const payload = {
      text: text.trim(),
      voice,
      lang,
      speed: Number(speed),
      total_step: Number(totalStep),
      silence_duration: Number(silence),
    };
    const mc = parseInt(maxChunk, 10);
    if (!Number.isNaN(mc)) payload.max_chunk_length = mc;
    try {
      const res = await synthesize(payload);
      setResult(res);
      setStatus("");
      if (user) {
        try { await saveGeneration(user.id, payload, res); setStatus("내 라이브러리에 저장됨 ✓"); }
        catch (e) { setStatus("생성 완료 (저장 실패: " + (e.message || e) + ")"); }
      }
      setLottie("success");
      setTimeout(() => setLottie("idle"), 1800);
    } catch (e) {
      setStatus("생성 실패: " + (e.message || e));
      setLottie("idle");
    } finally {
      setBusy(false);
    }
  }

  const audioUrl = result?.mp3_url || result?.audio_url;
  const wavUrl = result?.wav_url;
  const srtUrl = result?.srt_url;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* TTS 생성 로딩/완료 Lottie 오버레이 */}
      {lottie !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40">
          <DotLottieReact
            key={lottie}
            src={lottie === "loading" ? "/lottie/tts-progress.lottie" : "/lottie/tts-success.lottie"}
            autoplay
            loop={lottie === "loading"}
            style={{ width: 220, height: 220 }}
          />
          <p className="mt-2 text-sm font-medium text-white">
            {lottie === "loading" ? "음성 생성 중…" : "완료!"}
          </p>
        </div>
      )}

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
            <button onClick={() => setShowShareNotice(false)}
              className="mt-5 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              확인
            </button>
          </div>
        </div>
      )}

      {/* 타이틀 영역 */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-800 p-8 text-center text-white shadow">
        <h1 className="text-2xl font-bold">AI 음성으로 콘텐츠를 만들어 보세요</h1>
      </div>

      {/* 입력 영역 - 생성 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">입력</h2>

        {/* 입력 방식 탭 */}
        <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 방식별 소스 컨트롤 */}
        {tab === "file" && (
          <div className="mb-3 rounded-lg border border-dashed border-slate-300 p-3 text-sm">
            <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={onFile}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
            <p className="mt-1 text-xs text-slate-400">컴퓨터의 .txt 파일을 선택하면 아래 입력칸에 불러옵니다.</p>
          </div>
        )}
        {tab === "sample" && (
          <div className="mb-3 space-y-4">
            {/* 대본 요청 (Script request) */}
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">대본 요청(Script request)</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={req.topic} onChange={(e) => setReq({ ...req, topic: e.target.value })}
                  placeholder="대본 요청 주제 (예: 30대 직장인을 위한 5분 위로 낭독문)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 sm:col-span-2" />
                <select value={req.tone} onChange={(e) => setReq({ ...req, tone: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                  {["차분함", "따뜻함", "정보형", "몰입형", "유쾌함"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={req.length} onChange={(e) => setReq({ ...req, length: e.target.value })}
                  placeholder="분량 (예: 3분)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                <input value={req.audience} onChange={(e) => setReq({ ...req, audience: e.target.value })}
                  placeholder="대상 (예: 일반 청취자)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                <select value={req.expression_tag_mode} onChange={(e) => setReq({ ...req, expression_tag_mode: e.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none">
                  <option value="none">표현 태그 없음(None)</option>
                  <option value="use">표현 태그 사용(Use)</option>
                </select>
                <input value={req.notes} onChange={(e) => setReq({ ...req, notes: e.target.value })}
                  placeholder="추가 요청 (포함 키워드, 금지 표현, 분위기 등)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 sm:col-span-2" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={submitRequest} disabled={reqBusy}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                  대본 요청 저장
                </button>
                <span className="text-xs text-slate-400">{reqMsg || "AI에게 넘길 요청 파일을 저장합니다."}</span>
              </div>
            </div>

            {/* 샘플 대본 (Sample script) */}
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">샘플 대본(Sample script)</div>
              <div className="flex gap-2">
                <select value={sampleId} onChange={onPickSample}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value="">샘플 대본을 선택하세요…</option>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                <button onClick={() => loadSamples()}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                  새로고침
                </button>
              </div>
            </div>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={tab === "manual" ? "읽어줄 텍스트를 입력하세요." : "위에서 불러온 내용이 여기에 표시됩니다. 수정도 가능합니다."}
          className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-brand-500"
        />
        <div className="mt-1 text-right text-xs text-slate-400">{text.length}자</div>

        <button onClick={generate} disabled={busy || !text.trim()}
          className="mt-3 w-full rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
          {busy ? "생성 중…" : "음성 생성"}
        </button>
        {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
      </section>

      {/* 출력 영역 - 다운로드 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">출력</h2>
        {audioUrl ? (
          <div className="space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex flex-wrap gap-2">
              <a href={audioUrl} download className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                MP3 다운로드
              </a>
              {wavUrl && (
                <a href={wavUrl} download className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                  WAV 다운로드
                </a>
              )}
              {srtUrl && (
                <a href={srtUrl} download className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
                  자막(SRT)
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">생성된 음성이 여기에 표시됩니다.</p>
        )}
      </section>

      {/* 설정값 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">설정</h2>

        {/* 사용자 설정 (프리셋) */}
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">사용자 설정(Custom)</span>
            <select key={presetVer} value={slot} onChange={(e) => setSlot(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none">
              {PRESET_SLOTS.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}
            </select>
            <button onClick={loadPreset} className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300">불러오기</button>
            <button onClick={savePreset} className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700">저장</button>
            <button onClick={clearPreset} className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300">삭제</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{slotStatus}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 목소리 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">목소리</label>
            <div className="flex gap-2">
              <select value={voice} onChange={(e) => setVoice(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500">
                <optgroup label="남성">
                  {VOICES.filter((v) => v.id.startsWith("M")).map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </optgroup>
                <optgroup label="여성">
                  {VOICES.filter((v) => v.id.startsWith("F")).map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </optgroup>
              </select>
              <button onClick={toggleSample}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${playing ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                title={playing ? "정지" : "샘플 듣기"}>
                {playing ? "⏹ 정지" : "▶ 샘플"}
              </button>
            </div>
          </div>

          {/* 언어 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">언어</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>

          <PresetSelect label="속도 선택(Speed)" value={speed} options={SPEED_OPTS} onChange={(v) => setSpeed(Number(v))} />
          <PresetSelect label="단계 선택(Steps)" value={totalStep} options={STEP_OPTS} onChange={(v) => setTotalStep(Number(v))} />
          <PresetSelect label="청크 선택(Chunk)" value={maxChunk} options={CHUNK_OPTS} onChange={(v) => setMaxChunk(v)} />
          <PresetSelect label="무음 선택(Silence)" value={silence} options={SILENCE_OPTS} onChange={(v) => setSilence(Number(v))} />
        </div>
        <audio ref={sampleRef} onEnded={() => setPlaying(false)} className="hidden" />
      </section>
    </div>
  );
}
