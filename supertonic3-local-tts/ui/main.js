const $ = (id) => document.getElementById(id);
const SETTINGS_PREFIX = "supertonic3-local-tts-custom-";
const ACTIVE_JOB_KEY = "supertonic3-local-tts-active-job";
const LAST_RESULT_KEY = "supertonic3-local-tts-last-result";
const THEME_KEY = "supertonic3-local-tts-theme-v2";
const TEXT_SCALE_KEY = "supertonic3-local-tts-text-scale";
let SCRIPT_CATALOG = [];
let SCRIPT_CUSTOMS = [];
let CUSTOM_SCRIPT_SORT = "latest";
let CUSTOM_SCRIPT_FILTER = "";
let CURRENT_TTS_RESULT = null;
let VOICE_SAMPLES = [];
let SERVER_OUTPUT_DIR = "";

const MP3_FFMPEG_NOTICE = [
  "개인 사용 OK",
  "ZIP에 ffmpeg 미포함",
  "내 PC의 ffmpeg로 변환",
  "재배포 시 라이선스 확인",
].join("\n");

const LANGUAGE_NAMES_KO = {
  English: "영어",
  Korean: "한국어",
  Japanese: "일본어",
  Arabic: "아랍어",
  Bulgarian: "불가리아어",
  Czech: "체코어",
  Danish: "덴마크어",
  German: "독일어",
  Greek: "그리스어",
  Spanish: "스페인어",
  Estonian: "에스토니아어",
  Finnish: "핀란드어",
  French: "프랑스어",
  Hindi: "힌디어",
  Croatian: "크로아티아어",
  Hungarian: "헝가리어",
  Indonesian: "인도네시아어",
  Italian: "이탈리아어",
  Lithuanian: "리투아니아어",
  Latvian: "라트비아어",
  Dutch: "네덜란드어",
  Polish: "폴란드어",
  Portuguese: "포르투갈어",
  Romanian: "루마니아어",
  Russian: "러시아어",
  Slovak: "슬로바키아어",
  Slovenian: "슬로베니아어",
  Swedish: "스웨덴어",
  Turkish: "튀르키예어",
  Ukrainian: "우크라이나어",
  Vietnamese: "베트남어",
  "Unknown fallback": "알 수 없음",
};

const PICK_OPTIONS = {
  speedPreset: {
    target: "speed",
    values: [
      ["0.8", "0.80 - 느림(slow)"],
      ["0.9", "0.90 - 안정적(steady)"],
      ["1", "1.00 - 보통(normal)"],
      ["1.05", "1.05 - 기본(default)"],
      ["1.15", "1.15 - 경쾌함(brisk)"],
      ["1.25", "1.25 - 빠름(fast)"],
      ["1.5", "1.50 - 매우 빠름(very fast)"],
      ["2", "2.00 - 최대(max)"],
    ],
  },
  stepsPreset: {
    target: "steps",
    values: [
      ["1", "1 - 초안(draft)"],
      ["4", "4 - 빠름(quick)"],
      ["8", "8 - 기본(default)"],
      ["10", "10 - 품질(quality)"],
      ["12", "12 - 고품질(high)"],
      ["20", "20 - 느림(slow)"],
      ["50", "50 - 극단(extreme)"],
      ["100", "100 - 최대(max)"],
    ],
  },
  chunkPreset: {
    target: "maxChunkLength",
    values: [
      ["", "자동(auto)"],
      ["80", "80 - 짧음(short)"],
      ["120", "120 - 한국어/일본어(ko/ja)"],
      ["200", "200 - 촘촘함(tight)"],
      ["300", "300 - 기본(default)"],
      ["500", "500 - 김(long)"],
      ["1000", "1000 - 매우 김(very long)"],
    ],
  },
  silencePreset: {
    target: "silenceDuration",
    values: [
      ["0", "0.00s - 없음(none)"],
      ["0.1", "0.10s - 촘촘함(tight)"],
      ["0.2", "0.20s - 짧음(short)"],
      ["0.3", "0.30s - 기본(default)"],
      ["0.5", "0.50s - 명확함(clear)"],
      ["1", "1.00s - 멈춤(pause)"],
    ],
  },
  intraThreadsPreset: {
    target: "intraThreads",
    values: [["", "자동(auto)"], ["1", "1"], ["2", "2"], ["4", "4"], ["8", "8"], ["16", "16"]],
  },
  interThreadsPreset: {
    target: "interThreads",
    values: [["", "자동(auto)"], ["1", "1"], ["2", "2"], ["4", "4"], ["8", "8"], ["16", "16"]],
  },
};

const FILTER_TIPS = {
  speed: {
    title: "속도(Speed)",
    body: "음성이 읽히는 빠르기를 조절합니다. 실제 음색과 발음 안정성에도 영향을 주므로, 대본 성격에 맞춰 조금씩 바꾸는 값입니다.",
    details: [
      "낮은 값은 차분하고 또렷하지만 전체 길이가 길어집니다.",
      "높은 값은 빠르고 경쾌하지만 발음이 뭉개지거나 숨이 부족하게 들릴 수 있습니다.",
      "뉴스/안내문은 1.00~1.10, 짧은 알림은 1.10~1.25 정도가 쓰기 좋습니다.",
    ],
    note: "권장(Recommended): 1.00~1.15, 기본(Default): 1.05",
  },
  steps: {
    title: "단계(Steps)",
    body: "생성 과정에서 모델이 음성을 다듬는 반복 횟수입니다. 품질과 생성 시간 사이를 조절하는 핵심 값입니다.",
    details: [
      "낮은 값은 빠르게 미리 듣기 할 때 좋지만 억양이나 발음이 덜 안정적일 수 있습니다.",
      "높은 값은 더 매끄러운 결과를 기대할 수 있지만 CPU 환경에서는 생성 시간이 늘어납니다.",
      "긴 대본을 여러 번 테스트할 때는 8로 확인하고, 최종본은 10~12로 올리는 방식이 편합니다.",
    ],
    note: "권장(Recommended): 빠른 확인 8, 품질 확인 10~12",
  },
  chunk: {
    title: "최대 청크(Max chunk)",
    body: "긴 대본을 한 번에 처리할 텍스트 묶음 길이입니다. 길게 말할 때 끊김과 안정성을 조절합니다.",
    details: [
      "짧은 청크는 메모리와 발음 안정성에 유리하지만 문장 사이 멈춤이 자주 생길 수 있습니다.",
      "긴 청크는 흐름이 자연스럽지만 너무 길면 반복, 누락, 처리 지연이 생길 수 있습니다.",
      "한국어/일본어처럼 문장 단위가 짧은 대본은 100~150부터 확인하는 편이 좋습니다.",
    ],
    note: "권장(Recommended): 한국어/일본어 120, 일반 장문 300",
  },
  silence: {
    title: "청크 무음(Chunk silence)",
    body: "분할된 대본 조각 사이에 넣을 쉬는 시간입니다. 대본이 여러 조각으로 나뉠 때 문장 사이 호흡을 만듭니다.",
    details: [
      "0에 가까우면 빠르게 이어지지만 문장 전환이 갑작스럽게 들릴 수 있습니다.",
      "0.3초 전후는 일반 안내문이나 설명 대본에서 자연스러운 편입니다.",
      "교육용/낭독용 대본처럼 문장마다 여유가 필요하면 0.5초 이상도 사용할 수 있습니다.",
    ],
    note: "권장(Recommended): 0.20~0.50초, 기본(Default): 0.30초",
  },
  model: {
    title: "모델(Model)",
    body: "사용할 Supertonic 모델을 고릅니다. 이 로컬 UI는 Supertonic 3 모델 호출을 중심으로 구성되어 있습니다.",
    details: [
      "모델이 바뀌면 사용 가능한 음성, 언어, 품질 특성이 달라질 수 있습니다.",
      "현재 구성에서는 supertonic-3가 기본값이며 가장 먼저 테스트할 모델입니다.",
    ],
    note: "일반 사용(Recommended): supertonic-3",
  },
  voice: {
    title: "음성(Voice)",
    body: "기본 제공 음성 프리셋입니다. 대본의 분위기와 목적에 맞춰 음색을 고르는 값입니다.",
    details: [
      "M 계열은 남성형, F 계열은 여성형 음색 프리셋입니다.",
      "같은 설정이라도 음성마다 말투, 속도감, 발음 느낌이 다르게 들릴 수 있습니다.",
      "최종 결과를 만들기 전에 같은 문장으로 2~3개 음성을 비교해보는 것이 좋습니다.",
    ],
    note: "프리셋(Preset): M1~M5, F1~F5",
  },
  language: {
    title: "언어(Language)",
    body: "대본을 어떤 언어 발음 규칙으로 읽을지 정합니다. 선택값은 발음, 억양, 문자 해석 방식에 영향을 줍니다.",
    details: [
      "한국어 대본은 한국어(Korean) - ko를 직접 선택하는 편이 안정적입니다.",
      "영어 문장이 섞인 한국어 대본은 ko로 두고 괄호 영어를 짧게 넣으면 자연스럽게 확인하기 좋습니다.",
      "자동(auto)은 편하지만 대본이 짧거나 여러 언어가 섞이면 의도와 다르게 해석될 수 있습니다.",
    ],
    note: "한국어 대본(Recommended): 한국어(Korean) - ko",
  },
  style: {
    title: "스타일 JSON 경로(Style JSON path)",
    body: "별도 음성 스타일 JSON 파일을 사용할 때 입력합니다. 기본 음성 프리셋 대신 외부 스타일 정보를 적용하는 고급 옵션입니다.",
    details: [
      "파일 경로를 넣으면 Voice 선택값보다 스타일 JSON이 우선될 수 있습니다.",
      "경로가 틀리면 생성이 실패할 수 있으므로 처음에는 비워 두고 기본 음성부터 확인하는 편이 좋습니다.",
    ],
    note: "일반 사용(Recommended): 비워 두기(optional)",
  },
  modelDir: {
    title: "모델 폴더(Model dir)",
    body: "모델 파일을 직접 둔 폴더가 있을 때 지정합니다. 모델 다운로드 위치를 별도로 관리할 때 쓰는 런타임 옵션입니다.",
    details: [
      "비워 두면 Supertonic 기본 캐시 위치를 사용합니다.",
      "여러 환경에서 같은 모델 폴더를 공유하거나 오프라인 실행을 준비할 때 지정할 수 있습니다.",
    ],
    note: "일반 사용(Recommended): 비워 두기(default cache)",
  },
  intraThreads: {
    title: "내부 스레드(Intra threads)",
    body: "하나의 연산 안에서 CPU 코어를 몇 개까지 쓸지 정합니다. CPU 사용량과 생성 속도에 직접 영향을 줍니다.",
    details: [
      "자동(auto)은 시스템이 적절한 값을 고르게 두는 방식입니다.",
      "값을 높이면 빨라질 수 있지만, 너무 높으면 다른 작업이 버벅이거나 오히려 느려질 수 있습니다.",
      "CPU 코어 수가 적은 PC에서는 2~4, 여유가 있으면 4~8부터 확인해보세요.",
    ],
    note: "권장(Recommended): 자동(auto) 또는 2~8",
  },
  interThreads: {
    title: "상호 스레드(Inter threads)",
    body: "여러 연산을 병렬로 돌릴 때 사용할 스레드 수입니다. 동시에 처리되는 작업 흐름을 조절합니다.",
    details: [
      "일반적인 단일 TTS 생성에서는 자동(auto)으로 충분한 경우가 많습니다.",
      "여러 요청을 동시에 처리하는 환경에서는 값을 조정해볼 수 있습니다.",
      "값을 올린다고 항상 빨라지는 것은 아니므로 실제 생성 시간을 비교하는 편이 정확합니다.",
    ],
    note: "권장(Recommended): 자동(auto)",
  },
  autoDownload: {
    title: "자동 다운로드(Auto download)",
    body: "생성된 결과 파일을 브라우저 다운로드 동작과 연결할지 정합니다. 파일 저장 자체와는 별개로 화면에서 받기 쉽게 하는 옵션입니다.",
    details: [
      "서버의 data 폴더에는 결과 파일이 항상 저장됩니다.",
      "켜 두면 생성 후 WAV, 대본, 자막, 로그 링크를 바로 내려받기 쉽습니다.",
    ],
    note: "빠른 확인(Recommended): 켜기(on)",
  },
  verbose: {
    title: "자세한 로그(Verbose)",
    body: "생성 과정의 세부 로그를 더 많이 남깁니다. 오류 원인이나 옵션 적용 상태를 확인할 때 쓰는 디버그 옵션입니다.",
    details: [
      "문제가 없을 때는 꺼 두면 로그가 깔끔합니다.",
      "모델 경로, 옵션 적용, 생성 실패 원인을 확인할 때 켜면 도움이 됩니다.",
    ],
    note: "문제 확인(Debug): 켜기(on), 일반 사용: 끄기(off)",
  },
  whisperRefine: {
    title: "Whisper 자막 보정(Whisper refine)",
    body: "생성된 WAV를 faster-whisper가 다시 듣고 실제 발화 시간 기준으로 SRT/VTT를 새로 만듭니다.",
    details: [
      "기본 자막은 입력 대본을 음성 길이에 비례해 나누지만, Whisper 자막은 실제 음성 구간을 기준으로 합니다.",
      "원본 대본 파일이 있으면 문장은 원문을 유지하고 타이밍만 Whisper 기준으로 맞춥니다.",
      "CPU medium 모델은 정확하지만 시간이 걸릴 수 있으므로 긴 대본에서는 완료까지 기다려야 합니다.",
    ],
    note: "추천(Recommended): 켜기(on), 결과 파일: *_whisper.srt / *_whisper.vtt",
  },
};

function log(message) {
  $("log").textContent = typeof message === "string" ? message : JSON.stringify(message, null, 2);
}

function savedTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === "dark" ? "dark" : "light";
}

function updateThemeToggle(theme) {
  const button = $("themeToggle");
  if (!button) return;
  const isLight = theme === "light";
  button.textContent = isLight ? "라이트(Light)" : "다크(Dark)";
  button.setAttribute("aria-pressed", String(isLight));
  button.title = isLight ? "다크 모드로 전환" : "라이트 모드로 전환";
}

function applyTheme(theme) {
  const normalized = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem(THEME_KEY, normalized);
  updateThemeToggle(normalized);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
}

function initTheme() {
  applyTheme(savedTheme());
}

function normalizedTextScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) return 115;
  return Math.min(180, Math.max(90, Math.round(scale / 5) * 5));
}

function applyTextScale(value) {
  const scale = normalizedTextScale(value);
  const slider = $("textScale");
  const output = $("textScaleValue");
  if (slider) slider.value = String(scale);
  if (output) output.textContent = `${scale}%`;
  document.documentElement.style.setProperty("--text-editor-font-size", `${16 * (scale / 100)}px`);
  localStorage.setItem(TEXT_SCALE_KEY, String(scale));
}

function initTextScale() {
  applyTextScale(localStorage.getItem(TEXT_SCALE_KEY) || "115");
}

function readStoredJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function belongsToCurrentOutput(saved) {
  if (!SERVER_OUTPUT_DIR) return true;
  return Boolean(saved?.output_dir && saved.output_dir === SERVER_OUTPUT_DIR);
}

function setLogReconnectState(enabled = true) {
  const outputLog = $("log");
  if (!outputLog) return;
  outputLog.classList.toggle("reconnectable", Boolean(enabled));
  outputLog.title = enabled
    ? "클릭하면 마지막 생성 상태 또는 최신 산출물을 다시 연결합니다."
    : "";
}

function rememberActiveJob(jobId) {
  localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({
    job_id: jobId,
    output_dir: SERVER_OUTPUT_DIR,
    saved_at: new Date().toISOString(),
  }));
  setLogReconnectState(true);
}

function clearActiveJob(jobId = null) {
  const saved = readStoredJson(ACTIVE_JOB_KEY);
  if (!saved || !jobId || saved.job_id === jobId) {
    localStorage.removeItem(ACTIVE_JOB_KEY);
  }
  setLogReconnectState(true);
}

function rememberLastResult(result) {
  if (!result?.audio_url) return;
  localStorage.setItem(LAST_RESULT_KEY, JSON.stringify({
    output_dir: SERVER_OUTPUT_DIR,
    saved_at: new Date().toISOString(),
    result,
  }));
  setLogReconnectState(true);
}

function option(value, label, selected = false) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  item.selected = selected;
  return item;
}

function languageLabel(code, name) {
  const ko = LANGUAGE_NAMES_KO[name] || name;
  return `${ko}(${name}) - ${code}`;
}

function voicePresetLabel(voice) {
  if (voice?.startsWith("M")) return `${voice} 남성(Male)`;
  if (voice?.startsWith("F")) return `${voice} 여성(Female)`;
  return voice || "";
}

function voiceSampleFor(voice) {
  return VOICE_SAMPLES.find((sample) => sample.voice === voice);
}

function fileUpdatedMs(script) {
  return Date.parse(script?.updated_at || "") || 0;
}

function compareCustomScriptName(a, b) {
  return String(a?.name || "").localeCompare(String(b?.name || ""), "ko", {
    numeric: true,
    sensitivity: "base",
  });
}

function visibleCustomScripts() {
  const query = CUSTOM_SCRIPT_FILTER.trim().toLowerCase();
  return [...SCRIPT_CUSTOMS]
    .filter((script) => !query || String(script.name || "").toLowerCase().includes(query))
    .sort((a, b) => {
      if (CUSTOM_SCRIPT_SORT === "oldest") return fileUpdatedMs(a) - fileUpdatedMs(b) || compareCustomScriptName(a, b);
      if (CUSTOM_SCRIPT_SORT === "name_asc") return compareCustomScriptName(a, b);
      if (CUSTOM_SCRIPT_SORT === "name_desc") return compareCustomScriptName(b, a);
      return fileUpdatedMs(b) - fileUpdatedMs(a) || compareCustomScriptName(a, b);
    });
}

function splitFileLabel(name) {
  const text = String(name || "");
  if (text.length <= 12) return [text];
  const extension = text.match(/\.[^.]+$/)?.[0] || "";
  const stem = extension ? text.slice(0, -extension.length) : text;
  const target = Math.ceil(stem.length / 2);
  let split = -1;
  let splitAfterDelimiter = false;
  for (let offset = 0; offset < stem.length; offset += 1) {
    const left = target - offset;
    const right = target + offset;
    if (left > 2 && /[-_\s.]/.test(stem[left])) {
      split = left;
      splitAfterDelimiter = true;
      break;
    }
    if (right < stem.length - 2 && /[-_\s.]/.test(stem[right])) {
      split = right;
      splitAfterDelimiter = true;
      break;
    }
  }
  if (split < 2 || split > stem.length - 2) split = target;
  const head = stem.slice(0, split).replace(/[-_\s.]+$/g, "");
  const tailStart = splitAfterDelimiter ? split + 1 : split;
  const tail = stem.slice(tailStart).replace(/^[-_\s.]+/g, "");
  return [head, `${tail}${extension}`].filter(Boolean);
}

function renderFileLabel(button, name) {
  button.replaceChildren(
    ...splitFileLabel(name).map((line) => {
      const span = document.createElement("span");
      span.className = "custom-script-card-line";
      span.textContent = line;
      return span;
    }),
  );
  button.classList.toggle("is-long-name", String(name || "").length > 22);
}

function updateCustomSortButtons() {
  document.querySelectorAll("[data-custom-sort]").forEach((button) => {
    const active = button.dataset.customSort === CUSTOM_SCRIPT_SORT;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function customScriptSortLabel() {
  return {
    latest: "최신순",
    oldest: "오래된순",
    name_asc: "파일명↑",
    name_desc: "파일명↓",
  }[CUSTOM_SCRIPT_SORT] || "최신순";
}

function customScriptStatusText(visibleCount = SCRIPT_CUSTOMS.length) {
  if (!SCRIPT_CUSTOMS.length) return "data/script_customs 폴더에 .txt 파일을 넣고 새로고침하세요.";
  const filtered = visibleCount !== SCRIPT_CUSTOMS.length
    ? ` · ${visibleCount}/${SCRIPT_CUSTOMS.length} 표시`
    : "";
  return `TXT ${SCRIPT_CUSTOMS.length}개 · ${customScriptSortLabel()}${filtered}`;
}

function voiceOptionLabel(voice) {
  return voiceSampleFor(voice)?.label || voicePresetLabel(voice);
}

function shortVoiceLabel(voice) {
  if (voice?.startsWith("M")) return `남성 ${voice}`;
  if (voice?.startsWith("F")) return `여성 ${voice}`;
  return voice || "";
}

function refreshVoiceOptionLabels() {
  const select = $("voice");
  if (!select) return;
  for (const item of select.options) {
    item.textContent = voiceOptionLabel(item.value);
  }
}

function setCurrentVoiceSampleState() {
  const button = $("voicePreviewCurrent");
  const select = $("voice");
  if (!button || !select) return;
  const sample = voiceSampleFor(select.value);
  button.disabled = !sample;
  button.textContent = sample ? `${select.value} 듣기(Play)` : "듣기(Play)";
  if (sample) {
    button.removeAttribute("aria-disabled");
  } else {
    button.setAttribute("aria-disabled", "true");
  }
  markActiveVoiceSample(select.value);
}

function markActiveVoiceSample(voice) {
  document.querySelectorAll(".voice-sample-control").forEach((control) => {
    const isActive = control.dataset.voice === voice;
    control.classList.toggle("is-selected", isActive);
    control.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(isActive));
    });
  });
}

function selectVoiceSample(voice, { shouldLog = true } = {}) {
  const sample = voiceSampleFor(voice);
  const status = $("voiceSampleStatus");
  if (!sample) {
    if (status) status.textContent = "샘플 없음(No sample)";
    return null;
  }
  $("voice").value = sample.voice;
  setCurrentVoiceSampleState();
  if (status) status.textContent = `${sample.label} 선택됨(Selected)`;
  if (shouldLog) {
    log({
      status: "음성 선택(Voice selected)",
      voice: sample.voice,
      url: sample.url,
    });
  }
  return sample;
}

function playVoiceSample(voice) {
  const sample = voiceSampleFor(voice);
  const player = $("voiceSamplePlayer");
  const status = $("voiceSampleStatus");
  if (!sample || !player) {
    if (status) status.textContent = "샘플 없음(No sample)";
    return;
  }
  player.src = sample.url;
  player.play().catch(() => {
    if (status) status.textContent = "재생 버튼을 한 번 더 누르세요(Press play again)";
  });
  if (status) status.textContent = `${sample.label} 재생 중(Playing)`;
  log({
    status: "음성 샘플 재생(Voice sample preview)",
    voice: sample.voice,
    url: sample.url,
  });
}

function renderVoiceSamples() {
  const grid = $("voiceSampleGrid");
  if (!grid) return;
  grid.replaceChildren(
    ...VOICE_SAMPLES.map((sample) => {
      const control = document.createElement("div");
      control.className = "voice-sample-control";
      control.dataset.voice = sample.voice;

      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "voice-sample-button voice-sample-play";
      playButton.dataset.voice = sample.voice;
      playButton.setAttribute("aria-pressed", "false");
      playButton.textContent = shortVoiceLabel(sample.voice);
      playButton.title = `${sample.label || voicePresetLabel(sample.voice)} 듣기`;
      playButton.setAttribute("aria-label", `${sample.label || voicePresetLabel(sample.voice)} 듣기`);
      playButton.addEventListener("click", () => playVoiceSample(sample.voice));

      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "voice-sample-button voice-sample-select";
      selectButton.dataset.voice = sample.voice;
      selectButton.setAttribute("aria-pressed", "false");
      selectButton.textContent = "선택";
      selectButton.addEventListener("click", () => selectVoiceSample(sample.voice));

      control.replaceChildren(playButton, selectButton);
      return control;
    }),
  );
  setCurrentVoiceSampleState();
}

async function loadVoiceSamples() {
  const status = $("voiceSampleStatus");
  try {
    const response = await fetch("/public/voice-samples.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    VOICE_SAMPLES = Array.isArray(data.samples) ? data.samples : [];
    refreshVoiceOptionLabels();
    renderVoiceSamples();
    if (status) status.textContent = `샘플 ${VOICE_SAMPLES.length}개 준비됨(${VOICE_SAMPLES.length} samples ready)`;
  } catch (err) {
    VOICE_SAMPLES = [];
    refreshVoiceOptionLabels();
    renderVoiceSamples();
    if (status) status.textContent = "샘플을 불러올 수 없음(samples unavailable)";
    log(`음성 샘플 불러오기 실패(Voice sample load failed): ${err.message || err}`);
  }
}

function maybeNumber(id) {
  const value = $(id).value.trim();
  return value === "" ? null : Number(value);
}

function maybeText(id) {
  const value = $(id).value.trim();
  return value === "" ? null : value;
}

function collectScriptRequest() {
  return {
    topic: maybeText("scriptRequestTopic"),
    tone: maybeText("scriptRequestTone"),
    length: maybeText("scriptRequestLength"),
    audience: maybeText("scriptRequestAudience"),
    expression_tag_mode: $("scriptRequestExpressionMode")?.value || "none",
    notes: maybeText("scriptRequestNotes"),
    language: $("lang")?.value || "ko",
  };
}

async function submitScriptRequest() {
  const button = $("scriptRequestSubmit");
  const status = $("scriptRequestStatus");
  const payload = collectScriptRequest();
  if (!payload.topic) {
    status.textContent = "주제를 먼저 입력하세요(Topic required).";
    $("scriptRequestTopic").focus();
    return;
  }
  button.disabled = true;
  status.textContent = "대본 요청 저장 중(Saving request)...";
  try {
    const response = await fetch("/api/script-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJsonResponse(response);
    status.textContent = `저장됨: ${data.request.id}`;
    log({
      status: "대본 요청 저장 완료(Script request saved)",
      request_file: data.request_relative_path || data.request_path,
      latest_file: data.latest_relative_path || data.latest_path,
      output_dir: data.output_dir,
      next_step: "Codex 또는 Cursor에게 '최신 대본 요청 처리해서 public/scripts.json에 등록해줘'라고 지시하세요.",
      request: data.request,
    });
  } catch (err) {
    status.textContent = "대본 요청 저장 실패(Request failed)";
    log(`대본 요청 저장 실패(Script request failed): ${err.message || err}`);
  } finally {
    button.disabled = false;
  }
}

function setDownload(id, url, label) {
  const link = $(id);
  link.href = url || "#";
  if (url) {
    link.download = url.split("/").pop();
    link.removeAttribute("aria-disabled");
  } else {
    link.download = "";
    link.setAttribute("aria-disabled", "true");
  }
  if (label) link.textContent = label;
}

function setMp3Button(enabled, hasMp3 = false) {
  const button = $("mp3ConvertDownload");
  if (!button) return;
  button.disabled = !enabled;
  button.textContent = hasMp3 ? "MP3 다시 받기/변환(MP3)" : "MP3 변환/다운로드(MP3)";
  if (enabled) {
    button.removeAttribute("aria-disabled");
  } else {
    button.setAttribute("aria-disabled", "true");
  }
}

function setRefineButton(enabled) {
  const button = $("refineExisting");
  if (!button) return;
  button.disabled = !enabled;
  if (enabled) {
    button.removeAttribute("aria-disabled");
  } else {
    button.setAttribute("aria-disabled", "true");
  }
}

function currentRefineTarget() {
  if (CURRENT_TTS_RESULT?.path || CURRENT_TTS_RESULT?.audio_url) return CURRENT_TTS_RESULT;
  const saved = readStoredJson(LAST_RESULT_KEY);
  if (belongsToCurrentOutput(saved) && (saved?.result?.path || saved?.result?.audio_url)) return saved.result;
  return null;
}

function triggerBrowserDownload(url) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = url.split("/").pop();
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function confirmMp3FfmpegNotice() {
  const first = window.confirm([
    "MP3 변환",
    "",
    MP3_FFMPEG_NOTICE,
    "",
    "WAV를 MP3로 변환할까요?",
  ].join("\n"));
  if (!first) return false;
  return window.confirm([
    "재확인",
    "",
    "개인 사용은 괜찮습니다.",
    "ffmpeg는 ZIP에 없습니다.",
    "함께 배포할 때만 라이선스를 확인하세요.",
    "",
    "진행할까요?",
  ].join("\n"));
}

function insertAtCursor(value) {
  const text = $("text");
  const start = text.selectionStart ?? text.value.length;
  const end = text.selectionEnd ?? text.value.length;
  text.value = `${text.value.slice(0, start)}${value}${text.value.slice(end)}`;
  text.selectionStart = text.selectionEnd = start + value.length;
  text.focus();
}

function applyLimits(limits) {
  if (!limits) return;
  const map = [
    ["speed", "speed"],
    ["total_step", "steps"],
    ["max_chunk_length", "maxChunkLength"],
    ["silence_duration", "silenceDuration"],
  ];
  for (const [key, id] of map) {
    const limit = limits[key];
    if (!limit) continue;
    const input = $(id);
    input.min = limit.min;
    input.max = limit.max;
    input.step = limit.step;
  }
}

function initPickers() {
  for (const [pickerId, config] of Object.entries(PICK_OPTIONS)) {
    const picker = $(pickerId);
    const manualOption = option("__manual", "프리셋 외 값(custom)");
    manualOption.disabled = true;
    picker.replaceChildren(
      manualOption,
      ...config.values.map(([value, label]) => option(value, label)),
    );
    picker.addEventListener("change", () => {
      if (picker.value === "__manual") return;
      $(config.target).value = picker.value;
    });
    $(config.target).addEventListener("input", () => syncPicker(pickerId));
  }
}

function initWheelGuards() {
  document.querySelectorAll("input[type='number'], select").forEach((control) => {
    control.addEventListener("wheel", (event) => {
      if (document.activeElement !== control) return;
      event.preventDefault();
      control.blur();
    }, { passive: false });
  });
}

function syncPicker(pickerId) {
  const config = PICK_OPTIONS[pickerId];
  const targetValue = $(config.target).value.trim();
  const hasMatch = config.values.some(([value]) => value === targetValue);
  $(pickerId).value = hasMatch ? targetValue : "__manual";
}

function syncAllPickers() {
  for (const pickerId of Object.keys(PICK_OPTIONS)) syncPicker(pickerId);
}

function setFilterTip(key = "speed") {
  const tip = FILTER_TIPS[key] || FILTER_TIPS.speed;
  const title = $("filterTipTitle");
  const body = $("filterTipBody");
  const note = $("filterTipNote");
  const details = $("filterTipDetails");
  if (!title || !body || !note || !details) return;
  title.textContent = tip.title;
  body.textContent = tip.body;
  note.textContent = tip.note;
  details.replaceChildren(
    ...(tip.details || []).map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );
}

function initFilterTips() {
  document.querySelectorAll("[data-tip-key]").forEach((field) => {
    const key = field.dataset.tipKey;
    field.addEventListener("mouseenter", () => setFilterTip(key));
    field.addEventListener("focusin", () => setFilterTip(key));
    field.addEventListener("click", () => setFilterTip(key));
  });
  setFilterTip("speed");
}

function collectSettings() {
  return {
    model: $("model").value,
    model_dir: maybeText("modelDir"),
    auto_download: $("autoDownload").checked,
    intra_op_num_threads: maybeNumber("intraThreads"),
    inter_op_num_threads: maybeNumber("interThreads"),
    voice: $("voice").value,
    voice_style_path: maybeText("voiceStylePath"),
    lang: $("lang").value,
    speed: Number($("speed").value),
    total_step: Number($("steps").value),
    max_chunk_length: maybeNumber("maxChunkLength"),
    silence_duration: Number($("silenceDuration").value),
    verbose: $("verbose").checked,
    whisper_refine: $("whisperRefine").checked,
  };
}

function applySettings(settings) {
  const setValue = (id, value) => {
    if (value !== undefined && value !== null) $(id).value = value;
  };
  setValue("model", settings.model);
  setValue("modelDir", settings.model_dir || "");
  if (typeof settings.auto_download === "boolean") $("autoDownload").checked = settings.auto_download;
  setValue("intraThreads", settings.intra_op_num_threads ?? "");
  setValue("interThreads", settings.inter_op_num_threads ?? "");
  setValue("voice", settings.voice);
  setValue("voiceStylePath", settings.voice_style_path || "");
  setValue("lang", settings.lang);
  setValue("speed", settings.speed);
  setValue("steps", settings.total_step);
  setValue("maxChunkLength", settings.max_chunk_length ?? "");
  setValue("silenceDuration", settings.silence_duration);
  if (typeof settings.verbose === "boolean") $("verbose").checked = settings.verbose;
  if (typeof settings.whisper_refine === "boolean") $("whisperRefine").checked = settings.whisper_refine;
  syncAllPickers();
  setCurrentVoiceSampleState();
}

async function loadScriptCatalog() {
  const selector = $("scriptCatalog");
  try {
    const response = await fetch("/public/scripts.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    SCRIPT_CATALOG = Array.isArray(catalog.scripts) ? catalog.scripts : [];
    selector.replaceChildren(
      option("", "직접 입력(Manual text)"),
      ...SCRIPT_CATALOG.map((script) =>
        option(script.id, `${script.title}${script.lang ? ` (${script.lang})` : ""}`),
      ),
    );
    $("scriptStatus").textContent = `대본 ${SCRIPT_CATALOG.length}개 불러옴(${SCRIPT_CATALOG.length} scripts loaded)`;
  } catch (err) {
    SCRIPT_CATALOG = [];
    selector.replaceChildren(option("", "직접 입력(Manual text)"));
    $("scriptStatus").textContent = "대본을 사용할 수 없음(scripts unavailable)";
    log(`대본 JSON 불러오기 실패(Script JSON load failed): ${err.message || err}`);
  }
}

function setScriptTab(mode = "manual") {
  const normalizedMode = mode === "sample" || mode === "request" ? "assist" : mode;
  document.querySelectorAll("[data-script-tab]").forEach((button) => {
    const active = button.dataset.scriptTab === normalizedMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const panels = {
    manual: $("scriptPanelManual"),
    custom: $("scriptPanelCustom"),
    assist: $("scriptPanelAssist"),
  };
  for (const [key, panel] of Object.entries(panels)) {
    if (!panel) continue;
    panel.hidden = key !== normalizedMode;
  }
  if (normalizedMode === "custom" && SCRIPT_CUSTOMS.length === 0) {
    loadCustomScripts();
  }
}

async function loadCustomScripts() {
  const selector = $("customScriptList");
  const status = $("customScriptStatus");
  if (!selector || !status) return;
  try {
    const response = await fetch("/api/script-customs", { cache: "no-store" });
    const data = await readJsonResponse(response);
    SCRIPT_CUSTOMS = Array.isArray(data.scripts) ? data.scripts : [];
    renderCustomScripts();
  } catch (err) {
    SCRIPT_CUSTOMS = [];
    selector.replaceChildren(option("", "TXT 파일 없음(No local TXT)"));
    $("customScriptCards")?.replaceChildren();
    status.textContent = "로컬 TXT를 불러올 수 없음(local TXT unavailable)";
    log(`로컬 TXT 목록 불러오기 실패(Local TXT list failed): ${err.message || err}`);
  }
}

function renderCustomScripts() {
  const selector = $("customScriptList");
  const status = $("customScriptStatus");
  const cards = $("customScriptCards");
  if (!selector || !status || !cards) return;
  const scripts = visibleCustomScripts();
  selector.replaceChildren(
    option("", "TXT 파일 선택(Choose local TXT)"),
    ...scripts.map((script) =>
      option(script.name, `${script.name}${script.size ? ` (${Math.ceil(script.size / 1024)}KB)` : ""}`),
    ),
  );
  cards.replaceChildren(
    ...scripts.map((script) => {
      const button = document.createElement("button");
      const sizeKb = script.size ? `${Math.ceil(script.size / 1024)}KB` : "";
      const updated = script.updated_at ? `수정: ${script.updated_at.replace("T", " ")}` : "";
      button.type = "button";
      button.className = "custom-script-card";
      button.dataset.scriptName = script.name;
      button.title = [script.name, updated, sizeKb].filter(Boolean).join("\n");
      button.setAttribute("aria-label", `${script.name} 불러오기`);
      renderFileLabel(button, script.name);
      button.addEventListener("click", () => {
        selector.value = script.name;
        applyCustomScript(script.name).catch((err) => {
          status.textContent = "로컬 TXT 불러오기 실패(local TXT load failed)";
          log(`로컬 TXT 불러오기 실패(Local TXT load failed): ${err.message || err}`);
        });
      });
      return button;
    }),
  );
  updateCustomSortButtons();
  document.querySelectorAll(".custom-script-card").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scriptName === selector.value);
    button.setAttribute("aria-pressed", String(button.dataset.scriptName === selector.value));
  });
  status.textContent = customScriptStatusText(scripts.length);
}

async function applyCustomScript(name) {
  const status = $("customScriptStatus");
  if (!name) {
    if (status) status.textContent = customScriptStatusText(visibleCustomScripts().length);
    return;
  }
  const script = SCRIPT_CUSTOMS.find((item) => item.name === name);
  if (status) status.textContent = `로컬 TXT 불러오는 중(Loading): ${name}`;
  const response = await fetch(`/api/script-customs/${encodeURIComponent(name)}`, { cache: "no-store" });
  const data = await readJsonResponse(response);
  $("text").value = data.text || "";
  document.querySelectorAll(".custom-script-card").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scriptName === name);
    button.setAttribute("aria-pressed", String(button.dataset.scriptName === name));
  });
  if (status) status.textContent = `${data.name} 불러옴(Loaded)`;
  log({
    status: "로컬 TXT 대본 불러옴(Local TXT loaded)",
    name: data.name,
    relative_path: data.relative_path,
    size: script?.size,
  });
}

async function applyScript(scriptId) {
  if (!scriptId) {
    $("scriptStatus").textContent = `대본 ${SCRIPT_CATALOG.length}개 불러옴(${SCRIPT_CATALOG.length} scripts loaded)`;
    return;
  }
  const script = SCRIPT_CATALOG.find((item) => item.id === scriptId);
  if (!script) {
    $("scriptStatus").textContent = "대본을 찾을 수 없음(script not found)";
    return;
  }
  if (script.text_url) {
    $("scriptStatus").textContent = `대본 파일 불러오는 중(Loading script file): ${script.title}`;
    const response = await fetch(script.text_url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Script file HTTP ${response.status}`);
    $("text").value = await response.text();
  } else {
    $("text").value = script.text || "";
  }
  applySettings({
    model: script.model,
    model_dir: script.model_dir,
    auto_download: script.auto_download,
    intra_op_num_threads: script.intra_op_num_threads,
    inter_op_num_threads: script.inter_op_num_threads,
    voice: script.voice,
    voice_style_path: script.voice_style_path,
    lang: script.lang,
    speed: script.speed,
    total_step: script.total_step,
    max_chunk_length: script.max_chunk_length,
    silence_duration: script.silence_duration,
    verbose: script.verbose,
    whisper_refine: script.whisper_refine,
  });
  $("scriptStatus").textContent = script.description || script.title;
  log(`대본 불러옴(Loaded script): ${script.title}`);
}

function presetKey(slot = $("presetSlot").value) {
  return `${SETTINGS_PREFIX}${slot}`;
}

function savedPreset(slot = $("presetSlot").value) {
  const raw = localStorage.getItem(presetKey(slot));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updatePresetStatus() {
  const slot = $("presetSlot").value;
  const saved = savedPreset(slot);
  $("presetStatus").textContent = saved
    ? `설정 ${slot}: 저장됨 ${saved.saved_at}`
    : `설정 ${slot}: 비어 있음`;
}

function savePreset() {
  const slot = $("presetSlot").value;
  const saved_at = new Date().toLocaleString();
  localStorage.setItem(presetKey(slot), JSON.stringify({ saved_at, settings: collectSettings() }));
  updatePresetStatus();
  log(`사용자 설정 ${slot} 저장됨(Saved Custom ${slot}).`);
}

function loadPreset() {
  const slot = $("presetSlot").value;
  const saved = savedPreset(slot);
  if (!saved?.settings) {
    updatePresetStatus();
    log(`사용자 설정 ${slot}이 비어 있음(Custom ${slot} is empty).`);
    return;
  }
  applySettings(saved.settings);
  updatePresetStatus();
  log(`사용자 설정 ${slot} 불러옴(Loaded Custom ${slot}).`);
}

function clearPreset() {
  const slot = $("presetSlot").value;
  localStorage.removeItem(presetKey(slot));
  updatePresetStatus();
  log(`사용자 설정 ${slot} 삭제됨(Cleared Custom ${slot}).`);
}

function resetWhisperDownloads() {
  setDownload("whisperSrtDownload", null, "Whisper 자막(SRT)");
  setDownload("whisperVttDownload", null, "Whisper 자막(VTT)");
  setDownload("whisperTxtDownload", null, "Whisper 대본(TXT)");
  setDownload("whisperLogDownload", null, "Whisper 로그(Log)");
}

function applyWhisperDownloads(data) {
  setDownload("whisperSrtDownload", data.whisper_srt_url, "Whisper 자막(SRT)");
  setDownload("whisperVttDownload", data.whisper_vtt_url, "Whisper 자막(VTT)");
  setDownload("whisperTxtDownload", data.whisper_txt_url, "Whisper 대본(TXT)");
  setDownload("whisperLogDownload", data.whisper_log_url, "Whisper 로그(Log)");
}

function applyTtsResult(data, { shouldLog = true } = {}) {
  if (!data?.audio_url) return;
  CURRENT_TTS_RESULT = data;
  $("player").src = data.audio_url;
  setDownload("download", data.audio_url, "음성(WAV)");
  setDownload("scriptDownload", data.script_url, "대본(Script)");
  setDownload("srtDownload", data.srt_url, "자막(SRT)");
  setDownload("vttDownload", data.vtt_url, "자막(VTT)");
  setDownload("inputLogDownload", data.input_log_url, "입력 로그(Input log)");
  applyWhisperDownloads(data);
  setRefineButton(Boolean(data.path || data.audio_url));
  setMp3Button(Boolean(data.path || data.audio_url), Boolean(data.mp3_url));
  rememberLastResult(data);
  if (shouldLog) log(data);
}

async function readJsonResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTts(payload) {
  if ((payload.text || "").length > 2500) {
    return runTtsJob(payload);
  }
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(response);
}

async function runTtsJob(payload) {
  log({
    status: "긴 대본 작업 등록 중(Starting long TTS job)",
    text_length: payload.text.length,
  });
  const response = await fetch("/api/tts-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const started = await readJsonResponse(response);
  rememberActiveJob(started.job_id);
  return pollTtsJob(started.job_id, { initialDelay: 1200 });
}

async function getTtsJob(jobId) {
  const statusResponse = await fetch(`/api/tts-job/${jobId}`, { cache: "no-store" });
  return readJsonResponse(statusResponse);
}

function logJobStatus(job) {
  log({
    job_id: job.job_id,
    status: job.status,
    message: job.message,
    text_length: job.text_length,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}

async function pollTtsJob(jobId, { initialDelay = 0 } = {}) {
  let waitMs = initialDelay;
  for (;;) {
    if (waitMs > 0) await delay(waitMs);
    const job = await getTtsJob(jobId);
    logJobStatus(job);
    if (job.status === "done") {
      clearActiveJob(jobId);
      rememberLastResult(job.result);
      return job.result;
    }
    if (job.status === "error") {
      clearActiveJob(jobId);
      throw new Error(job.error || job.message || "TTS job failed");
    }
    waitMs = Math.min(3000, (waitMs || 900) + 300);
  }
}

async function getLatestOutput() {
  const response = await fetch("/api/latest-output", { cache: "no-store" });
  return readJsonResponse(response);
}

async function resumeLastGeneration() {
  const active = readStoredJson(ACTIVE_JOB_KEY);
  if (active && !belongsToCurrentOutput(active)) {
    localStorage.removeItem(ACTIVE_JOB_KEY);
  }
  if (active?.job_id && belongsToCurrentOutput(active)) {
    try {
      log({
        status: "마지막 생성 작업에 다시 연결 중(Reconnecting to generation job)",
        job_id: active.job_id,
        saved_at: active.saved_at,
      });
      const result = await pollTtsJob(active.job_id, { initialDelay: 0 });
      applyTtsResult(result, { shouldLog: false });
      log({ status: "재연결 완료(Reconnected)", result });
      return;
    } catch (err) {
      if (String(err.message || err).includes("job not found") || String(err.message || err).includes("HTTP 404")) {
        clearActiveJob(active.job_id);
      }
      log({
        status: "작업 재연결 실패, 최신 산출물 확인 중(Checking latest output)",
        job_id: active.job_id,
        error: err.message || String(err),
      });
    }
  }

  try {
    const latest = await getLatestOutput();
    if (latest?.result) {
      applyTtsResult(latest.result, { shouldLog: false });
      log({ status: "최신 산출물 연결 완료(Latest output restored)", result: latest.result });
      return;
    }
  } catch (err) {
    const saved = readStoredJson(LAST_RESULT_KEY);
    if (belongsToCurrentOutput(saved) && saved?.result?.audio_url) {
      applyTtsResult(saved.result, { shouldLog: false });
      log({
        status: "브라우저에 저장된 마지막 결과를 복원함(Restored cached result)",
        saved_at: saved.saved_at,
        result: saved.result,
      });
      return;
    }
    throw err;
  }

  throw new Error("복원할 생성 작업 또는 산출물이 없습니다.");
}

async function refineWhisperSubtitles(ttsData) {
  const lang = $("lang").value === "auto" ? "ko" : $("lang").value;
  const audioPath = ttsData.path || (ttsData.audio_url ? ttsData.audio_url.split("/").pop() : null);
  if (!audioPath) throw new Error("보정할 WAV 파일을 먼저 불러오세요.");
  const response = await fetch("/api/refine-subtitles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_path: audioPath,
      language: ttsData.lang || lang || "ko",
      whisper_model: "medium",
      compute_type: "int8",
      beam_size: 5,
      text_source: "auto",
    }),
  });
  const data = await readJsonResponse(response);
  applyWhisperDownloads(data);
  return data;
}

async function refineCurrentOutput() {
  const target = currentRefineTarget();
  if (!target) throw new Error("보정할 기존 WAV를 먼저 생성하거나 로그를 클릭해 불러오세요.");
  const button = $("refineExisting");
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  log({ ...target, whisper_status: "Whisper 보정 실행 중(Refining existing output)..." });
  try {
    const refined = await refineWhisperSubtitles(target);
    const merged = { ...target, ...refined };
    applyTtsResult(merged, { shouldLog: false });
    log({ status: "Whisper 보정 완료(Refine done)", result: merged });
  } finally {
    setRefineButton(Boolean(currentRefineTarget()));
  }
}

async function convertCurrentOutputToMp3() {
  const target = currentRefineTarget();
  if (!target) throw new Error("MP3로 변환할 WAV를 먼저 생성하거나 로그를 클릭해 불러오세요.");
  if (!confirmMp3FfmpegNotice()) {
    log("MP3 변환 취소됨(Cancelled).");
    return;
  }

  const audioPath = target.path || (target.audio_url ? target.audio_url.split("/").pop() : null);
  if (!audioPath) throw new Error("MP3로 변환할 WAV 경로를 찾지 못했습니다.");

  const button = $("mp3ConvertDownload");
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  log({
    status: "MP3 변환 중(Converting WAV to MP3)",
    notice: MP3_FFMPEG_NOTICE,
    audio_path: audioPath,
  });
  try {
    const response = await fetch("/api/convert-mp3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: audioPath }),
    });
    const data = await readJsonResponse(response);
    const merged = { ...target, ...data };
    applyTtsResult(merged, { shouldLog: false });
    log({ status: "MP3 변환 완료(MP3 ready)", result: merged, notice: MP3_FFMPEG_NOTICE });
    triggerBrowserDownload(data.mp3_url);
  } finally {
    setMp3Button(Boolean(currentRefineTarget()), Boolean(CURRENT_TTS_RESULT?.mp3_url));
  }
}

async function init() {
  initTheme();
  initTextScale();
  initPickers();
  initWheelGuards();
  initFilterTips();
  for (const id of [
    "download",
    "scriptDownload",
    "srtDownload",
    "vttDownload",
    "whisperSrtDownload",
    "whisperVttDownload",
    "whisperTxtDownload",
    "whisperLogDownload",
    "inputLogDownload",
  ]) {
    setDownload(id, null);
  }
  setMp3Button(false);
  setRefineButton(false);
  $("log").tabIndex = 0;
  setLogReconnectState(true);

  try {
    const health = await fetch("/health").then((response) => response.json());
    SERVER_OUTPUT_DIR = health.output_dir || "";
    $("status").textContent = health.ok ? `준비됨(ready) - ${health.engine}` : "준비 안 됨(not ready)";

    const options = await fetch("/api/options").then((response) => response.json());
    if (!options.ok) throw new Error(options.error || "옵션을 불러올 수 없음(Could not load options)");

    $("model").replaceChildren(
      ...options.models.map((model) => option(model, model, model === options.defaults.model)),
    );

    $("voice").replaceChildren(
      ...options.voices.map((voice) => option(voice, voiceOptionLabel(voice), voice === options.defaults.voice)),
    );

    const langOptions = [
      option("auto", "자동(auto) - SDK 기본값(SDK default)", false),
      ...options.languages.map(({ code, name }) =>
        option(code, languageLabel(code, name), code === options.defaults.lang),
      ),
    ];
    $("lang").replaceChildren(...langOptions);

    $("speed").value = options.defaults.speed;
    $("steps").value = options.defaults.total_step;
    $("silenceDuration").value = options.defaults.silence_duration;
    $("autoDownload").checked = options.defaults.auto_download;
    $("verbose").checked = options.defaults.verbose;
    $("whisperRefine").checked = false;
    applyLimits(options.limits);
    syncAllPickers();
    updatePresetStatus();

    $("tagRow").replaceChildren(
      ...options.expression_tags.map((tag) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tag";
        button.textContent = tag;
        button.addEventListener("click", () => insertAtCursor(tag));
        return button;
      }),
    );
    await loadVoiceSamples();
    await loadScriptCatalog();
    await loadCustomScripts();
    setScriptTab("manual");
  } catch (err) {
    $("status").textContent = "서버 오프라인(server offline)";
    log(String(err));
  }
}

$("log").addEventListener("click", () => {
  resumeLastGeneration().catch((err) => {
    log(`복원 실패(Restore failed): ${err.message || err}`);
  });
});
$("log").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  resumeLastGeneration().catch((err) => {
    log(`복원 실패(Restore failed): ${err.message || err}`);
  });
});

$("scriptCatalog").addEventListener("change", () => {
  applyScript($("scriptCatalog").value).catch((err) => {
    $("scriptStatus").textContent = "대본 불러오기 실패(script load failed)";
    log(`대본 불러오기 실패(Script load failed): ${err.message || err}`);
  });
});
$("reloadScripts").addEventListener("click", loadScriptCatalog);
$("customScriptList").addEventListener("change", () => {
  applyCustomScript($("customScriptList").value).catch((err) => {
    $("customScriptStatus").textContent = "로컬 TXT 불러오기 실패(local TXT load failed)";
    log(`로컬 TXT 불러오기 실패(Local TXT load failed): ${err.message || err}`);
  });
});
$("reloadCustomScripts").addEventListener("click", loadCustomScripts);
document.querySelectorAll("[data-custom-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    CUSTOM_SCRIPT_SORT = button.dataset.customSort || "latest";
    renderCustomScripts();
  });
});
$("customScriptSearch").addEventListener("input", () => {
  CUSTOM_SCRIPT_FILTER = $("customScriptSearch").value;
  renderCustomScripts();
});
document.querySelectorAll("[data-script-tab]").forEach((button) => {
  button.addEventListener("click", () => setScriptTab(button.dataset.scriptTab));
});
$("presetSlot").addEventListener("change", updatePresetStatus);
$("savePreset").addEventListener("click", savePreset);
$("loadPreset").addEventListener("click", loadPreset);
$("clearPreset").addEventListener("click", clearPreset);
$("themeToggle").addEventListener("click", toggleTheme);
$("textScale").addEventListener("input", () => applyTextScale($("textScale").value));
$("scriptRequestSubmit").addEventListener("click", submitScriptRequest);
$("voice").addEventListener("change", setCurrentVoiceSampleState);
$("voicePreviewCurrent").addEventListener("click", () => playVoiceSample($("voice").value));
$("refineExisting").addEventListener("click", () => {
  refineCurrentOutput().catch((err) => {
    log(`Whisper 보정 실패(Refine failed): ${err.message || err}`);
    setRefineButton(Boolean(currentRefineTarget()));
  });
});
$("mp3ConvertDownload").addEventListener("click", () => {
  convertCurrentOutputToMp3().catch((err) => {
    log(`MP3 변환 실패(MP3 convert failed): ${err.message || err}`);
    setMp3Button(Boolean(currentRefineTarget()), Boolean(CURRENT_TTS_RESULT?.mp3_url));
  });
});

$("ttsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("generate");
  button.disabled = true;
  log("생성 중(Generating)...");
  CURRENT_TTS_RESULT = null;
  setRefineButton(false);
  setMp3Button(false);
  resetWhisperDownloads();

  try {
    const payload = {
      text: $("text").value,
      ...collectSettings(),
    };

    const data = await createTts(payload);
    applyTtsResult(data, { shouldLog: false });

    $("player").src = data.audio_url;
    setDownload("download", data.audio_url, "음성(WAV)");
    setDownload("scriptDownload", data.script_url, "대본(Script)");
    setDownload("srtDownload", data.srt_url, "자막(SRT)");
    setDownload("vttDownload", data.vtt_url, "자막(VTT)");
    setDownload("inputLogDownload", data.input_log_url, "입력 로그(Input log)");
    log(data);

    if ($("whisperRefine").checked) {
      try {
        log({ ...data, whisper_status: "Whisper 자막 보정 중(Refining subtitles)..." });
        const refined = await refineWhisperSubtitles(data);
        applyTtsResult({ ...data, ...refined }, { shouldLog: false });
        log({ ...data, whisper: refined });
      } catch (err) {
        log({ ...data, whisper_error: err.message || String(err) });
      }
    }
  } catch (err) {
    log(`오류(ERROR): ${err.message || err}`);
  } finally {
    button.disabled = false;
  }
});

init();
