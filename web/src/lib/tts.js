// TTS API client — talks to the HF Space backend via same-origin /api proxy
// (Vercel rewrites in prod, Vite proxy in dev).

// Friendly Korean persona names with a per-voice avatar image.
export const VOICES = [
  { id: "M1", name: "민호", icon: "👨", img: "/voices/ico-m-01.png" },
  { id: "M2", name: "경식", icon: "👨", img: "/voices/ico-m-02.png" },
  { id: "M3", name: "영수", icon: "👨", img: "/voices/ico-m-03.png" },
  { id: "M4", name: "상철", icon: "👨", img: "/voices/ico-m-04.png" },
  { id: "M5", name: "동훈", icon: "👨", img: "/voices/ico-m-05.png" },
  { id: "F1", name: "영숙", icon: "👩", img: "/voices/ico-w-01.png" },
  { id: "F2", name: "옥순", icon: "👩", img: "/voices/ico-w-02.png" },
  { id: "F3", name: "영자", icon: "👩", img: "/voices/ico-w-03.png" },
  { id: "F4", name: "미숙", icon: "👩", img: "/voices/ico-w-04.png" },
  { id: "F5", name: "정희", icon: "👩", img: "/voices/ico-w-05.png" },
].map((v) => ({ ...v, label: `${v.icon} ${v.name}` }));

export function voiceLabel(id) {
  const v = VOICES.find((x) => x.id === id);
  return v ? v.label : id;
}
export function voiceName(id) {
  const v = VOICES.find((x) => x.id === id);
  return v ? v.name : id;
}
export function voiceImg(id) {
  const v = VOICES.find((x) => x.id === id);
  return v ? v.img : null;
}

// Languages supported by the backend (subset of the engine list, common first).
export const LANGS = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "English" },
  { code: "ja", name: "日本語" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "hi", name: "हिन्दी" },
  { code: "id", name: "Indonesia" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "tr", name: "Türkçe" },
  { code: "pl", name: "Polski" },
  { code: "nl", name: "Nederlands" },
];

export function sampleUrl(voice) {
  return `/public/voice-samples/${voice}.wav`;
}

// Preset dropdown options (value, label) mirrored from the legacy UI.
export const SPEED_OPTS = [
  ["0.8", "0.80 - 느림(slow)"], ["0.9", "0.90 - 안정적(steady)"], ["1", "1.00 - 보통(normal)"],
  ["1.05", "1.05 - 기본(default)"], ["1.15", "1.15 - 경쾌함(brisk)"], ["1.25", "1.25 - 빠름(fast)"],
  ["1.5", "1.50 - 매우 빠름(very fast)"], ["2", "2.00 - 최대(max)"],
];
export const STEP_OPTS = [
  ["1", "1 - 초안(draft)"], ["4", "4 - 빠름(quick)"], ["8", "8 - 기본(default)"],
  ["10", "10 - 품질(quality)"], ["12", "12 - 고품질(high)"], ["20", "20 - 느림(slow)"],
  ["50", "50 - 극단(extreme)"], ["100", "100 - 최대(max)"],
];
export const CHUNK_OPTS = [
  ["", "자동(auto)"], ["80", "80 - 짧음(short)"], ["120", "120 - 한국어/일본어(ko/ja)"],
  ["200", "200 - 촘촘함(tight)"], ["300", "300 - 기본(default)"], ["500", "500 - 김(long)"],
  ["1000", "1000 - 매우 김(very long)"],
];
export const SILENCE_OPTS = [
  ["0", "0.00s - 없음(none)"], ["0.1", "0.10s - 촘촘함(tight)"], ["0.2", "0.20s - 짧음(short)"],
  ["0.3", "0.30s - 기본(default)"], ["0.5", "0.50s - 명확함(clear)"], ["1", "1.00s - 멈춤(pause)"],
];

async function readJson(res) {
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollJob(jobId) {
  let wait = 1200;
  for (;;) {
    await delay(wait);
    const res = await fetch(`/api/tts-job/${jobId}`, { cache: "no-store" });
    const job = await readJson(res);
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error || job.message || "TTS job failed");
    wait = Math.min(3000, wait + 300);
  }
}

// payload: { text, voice, lang, speed, total_step }
// Always go through the async job + poll path. Synthesis on the free CPU tier
// is slow (~0.1s/char), so a synchronous request for anything but a short clip
// outlives the edge proxy timeout and returns 502. The job endpoint responds
// immediately with a job_id and we poll, so no single request is held long
// enough to time out, regardless of text length.
export async function synthesize(payload) {
  const res = await fetch("/api/tts-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const started = await readJson(res);
  return pollJob(started.job_id);
}
