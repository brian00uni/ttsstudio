// TTS API client — talks to the HF Space backend via same-origin /api proxy
// (Vercel rewrites in prod, Vite proxy in dev).

export const VOICES = [
  { id: "M1", label: "남성 M1" },
  { id: "M2", label: "남성 M2" },
  { id: "M3", label: "남성 M3" },
  { id: "M4", label: "남성 M4" },
  { id: "M5", label: "남성 M5" },
  { id: "F1", label: "여성 F1" },
  { id: "F2", label: "여성 F2" },
  { id: "F3", label: "여성 F3" },
  { id: "F4", label: "여성 F4" },
  { id: "F5", label: "여성 F5" },
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
