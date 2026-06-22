// TTS API client — talks to the HF Space backend via same-origin /api proxy
// (Vercel rewrites in prod, Vite proxy in dev).

// Friendly Korean persona names with a face icon per voice id.
export const VOICES = [
  { id: "M1", name: "민호", icon: "👨" },
  { id: "M2", name: "경식", icon: "👨" },
  { id: "M3", name: "영수", icon: "👨" },
  { id: "M4", name: "상철", icon: "👨" },
  { id: "M5", name: "동훈", icon: "👨" },
  { id: "F1", name: "영숙", icon: "👩" },
  { id: "F2", name: "옥순", icon: "👩" },
  { id: "F3", name: "영자", icon: "👩" },
  { id: "F4", name: "미숙", icon: "👩" },
  { id: "F5", name: "정희", icon: "👩" },
].map((v) => ({ ...v, label: `${v.icon} ${v.name}` }));

export function voiceLabel(id) {
  const v = VOICES.find((x) => x.id === id);
  return v ? v.label : id;
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
export async function synthesize(payload) {
  if ((payload.text || "").length > 2500) {
    const res = await fetch("/api/tts-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const started = await readJson(res);
    return pollJob(started.job_id);
  }
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}
