/*
 * ttsstudio Supabase integration (frontend-only, RLS-secured).
 * - Email/password auth
 * - Auto-saves each generated audio to Storage + a `generations` history row
 * - "내 라이브러리" panel to browse / play / delete past generations
 * Non-invasive: wraps window.fetch to capture TTS results without editing main.js.
 */
(function () {
  "use strict";

  var cfg = window.TTS_SUPABASE || {};
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf("__") === 0) {
    console.warn("[ttsstudio] Supabase not configured; library/auth disabled.");
    return;
  }
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var user = null;
  var historyOpen = false;
  var origFetch = window.fetch.bind(window);

  // ---------------------------------------------------------------- styles
  var css = document.createElement("style");
  css.textContent = [
    "#tts-auth{position:fixed;top:10px;right:12px;z-index:9999;font-family:inherit;display:flex;gap:8px;align-items:center}",
    "#tts-auth button{cursor:pointer;border:0;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600}",
    ".tts-btn-primary{background:#4f46e5;color:#fff}",
    ".tts-btn-ghost{background:rgba(120,120,140,.18);color:inherit}",
    "#tts-auth .tts-email{font-size:12px;opacity:.8;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".tts-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center}",
    ".tts-modal{background:#fff;color:#111;border-radius:14px;padding:22px;width:320px;max-width:92vw;box-shadow:0 18px 50px rgba(0,0,0,.3)}",
    ".tts-modal h3{margin:0 0 14px;font-size:18px}",
    ".tts-modal input{width:100%;box-sizing:border-box;margin:6px 0;padding:10px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px}",
    ".tts-modal .row{display:flex;gap:8px;margin-top:12px}",
    ".tts-modal .row button{flex:1;padding:10px;border-radius:8px;border:0;cursor:pointer;font-weight:600}",
    ".tts-modal .msg{font-size:12px;margin-top:10px;min-height:16px;color:#dc2626}",
    ".tts-modal .switch{font-size:12px;margin-top:12px;text-align:center;opacity:.8}",
    ".tts-modal .switch a{color:#4f46e5;cursor:pointer;font-weight:600}",
    ".tts-panel{position:fixed;top:0;right:0;height:100%;width:380px;max-width:94vw;background:#fff;color:#111;z-index:10000;box-shadow:-12px 0 40px rgba(0,0,0,.25);transform:translateX(100%);transition:transform .25s;display:flex;flex-direction:column}",
    ".tts-panel.open{transform:none}",
    ".tts-panel header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #eee}",
    ".tts-panel header h3{margin:0;font-size:16px}",
    ".tts-panel .list{flex:1;overflow:auto;padding:12px}",
    ".tts-item{border:1px solid #eee;border-radius:10px;padding:10px;margin-bottom:10px}",
    ".tts-item .t{font-size:13px;line-height:1.4;max-height:3.8em;overflow:hidden}",
    ".tts-item .meta{font-size:11px;opacity:.6;margin:6px 0}",
    ".tts-item audio{width:100%;margin-top:4px}",
    ".tts-item .del{margin-top:6px;font-size:11px;color:#dc2626;background:none;border:0;cursor:pointer;padding:0}",
    ".tts-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:10001;opacity:0;transition:opacity .2s}",
    ".tts-toast.show{opacity:.95}",
  ].join("\n");
  document.head.appendChild(css);

  // ---------------------------------------------------------------- toast
  var toastEl = document.createElement("div");
  toastEl.className = "tts-toast";
  document.body.appendChild(toastEl);
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  // ---------------------------------------------------------------- auth bar
  var bar = document.createElement("div");
  bar.id = "tts-auth";
  document.body.appendChild(bar);

  function renderAuth() {
    bar.innerHTML = "";
    if (user) {
      var email = document.createElement("span");
      email.className = "tts-email";
      email.textContent = user.email || "로그인됨";
      var lib = btn("내 라이브러리", "tts-btn-primary", openHistory);
      var out = btn("로그아웃", "tts-btn-ghost", function () { sb.auth.signOut(); });
      bar.appendChild(email); bar.appendChild(lib); bar.appendChild(out);
    } else {
      bar.appendChild(btn("로그인 / 가입", "tts-btn-primary", openAuthModal));
    }
  }
  function btn(label, cls, onClick) {
    var b = document.createElement("button");
    b.textContent = label; b.className = cls; b.onclick = onClick;
    return b;
  }

  // ---------------------------------------------------------------- auth modal
  function openAuthModal() {
    var mode = "login";
    var bg = document.createElement("div");
    bg.className = "tts-modal-bg";
    bg.onclick = function (e) { if (e.target === bg) document.body.removeChild(bg); };
    var box = document.createElement("div");
    box.className = "tts-modal";
    bg.appendChild(box);
    document.body.appendChild(bg);

    function draw() {
      box.innerHTML = "";
      var h = document.createElement("h3");
      h.textContent = mode === "login" ? "로그인" : "회원가입";
      var email = inp("email", "이메일");
      var pw = inp("password", "비밀번호 (6자 이상)");
      var msg = document.createElement("div"); msg.className = "msg";
      var row = document.createElement("div"); row.className = "row";
      var go = document.createElement("button");
      go.style.background = "#4f46e5"; go.style.color = "#fff";
      go.textContent = mode === "login" ? "로그인" : "가입하기";
      var cancel = document.createElement("button");
      cancel.style.background = "#e4e4e7"; cancel.textContent = "취소";
      cancel.onclick = function () { document.body.removeChild(bg); };
      row.appendChild(go); row.appendChild(cancel);
      var sw = document.createElement("div"); sw.className = "switch";
      var a = document.createElement("a");
      a.textContent = mode === "login" ? "계정이 없나요? 가입" : "이미 계정이 있나요? 로그인";
      a.onclick = function () { mode = mode === "login" ? "signup" : "login"; draw(); };
      sw.appendChild(a);

      go.onclick = async function () {
        msg.style.color = "#dc2626"; msg.textContent = "";
        var e = email.value.trim(), p = pw.value;
        if (!e || !p) { msg.textContent = "이메일과 비밀번호를 입력하세요."; return; }
        go.disabled = true; go.textContent = "처리 중...";
        try {
          if (mode === "login") {
            var r = await sb.auth.signInWithPassword({ email: e, password: p });
            if (r.error) throw r.error;
            document.body.removeChild(bg);
            toast("로그인 완료");
          } else {
            var s = await sb.auth.signUp({ email: e, password: p });
            if (s.error) throw s.error;
            if (s.data.session) { document.body.removeChild(bg); toast("가입 완료"); }
            else { msg.style.color = "#16a34a"; msg.textContent = "확인 메일을 보냈습니다. 메일의 링크를 클릭한 뒤 로그인하세요."; }
          }
        } catch (err) {
          msg.textContent = translateErr(err.message || String(err));
        } finally { go.disabled = false; go.textContent = mode === "login" ? "로그인" : "가입하기"; }
      };

      box.appendChild(h); box.appendChild(email); box.appendChild(pw);
      box.appendChild(row); box.appendChild(msg); box.appendChild(sw);
      email.focus();
    }
    function inp(type, ph) {
      var i = document.createElement("input");
      i.type = type; i.placeholder = ph; return i;
    }
    draw();
  }

  function translateErr(m) {
    if (/Invalid login/i.test(m)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (/already registered/i.test(m)) return "이미 가입된 이메일입니다.";
    if (/at least 6/i.test(m)) return "비밀번호는 6자 이상이어야 합니다.";
    return m;
  }

  // ---------------------------------------------------------------- history panel
  var panel = document.createElement("div");
  panel.className = "tts-panel";
  panel.innerHTML =
    '<header><h3>내 라이브러리</h3><button class="tts-btn-ghost" id="tts-close">닫기</button></header>' +
    '<div class="list" id="tts-list"></div>';
  document.body.appendChild(panel);
  panel.querySelector("#tts-close").onclick = function () {
    historyOpen = false; panel.classList.remove("open");
  };
  function openHistory() { historyOpen = true; panel.classList.add("open"); loadHistory(); }

  async function loadHistory() {
    var list = panel.querySelector("#tts-list");
    list.innerHTML = '<p style="opacity:.6;font-size:13px">불러오는 중...</p>';
    var r = await sb.from("generations").select("*").order("created_at", { ascending: false }).limit(50);
    if (r.error) { list.innerHTML = '<p style="color:#dc2626">불러오기 실패: ' + r.error.message + "</p>"; return; }
    if (!r.data.length) { list.innerHTML = '<p style="opacity:.6;font-size:13px">아직 저장된 음성이 없습니다. 음성을 생성하면 자동 저장됩니다.</p>'; return; }
    list.innerHTML = "";
    for (var i = 0; i < r.data.length; i++) list.appendChild(await renderItem(r.data[i]));
  }

  async function renderItem(row) {
    var el = document.createElement("div");
    el.className = "tts-item";
    var t = document.createElement("div"); t.className = "t"; t.textContent = row.text || "(제목 없음)";
    var meta = document.createElement("div"); meta.className = "meta";
    meta.textContent = [row.voice, row.lang, row.duration ? row.duration.toFixed(1) + "s" : null,
      new Date(row.created_at).toLocaleString()].filter(Boolean).join(" · ");
    el.appendChild(t); el.appendChild(meta);
    var signed = await sb.storage.from("audio").createSignedUrl(row.audio_path, 3600);
    if (signed.data && signed.data.signedUrl) {
      var audio = document.createElement("audio"); audio.controls = true; audio.src = signed.data.signedUrl;
      el.appendChild(audio);
    }
    var del = document.createElement("button"); del.className = "del"; del.textContent = "삭제";
    del.onclick = async function () {
      if (!confirm("이 음성을 삭제할까요?")) return;
      await sb.storage.from("audio").remove([row.audio_path]);
      await sb.from("generations").delete().eq("id", row.id);
      loadHistory();
    };
    el.appendChild(del);
    return el;
  }

  // ---------------------------------------------------------------- auto-save via fetch wrap
  var jobPayloads = {};
  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || (typeof input === "object" && input.method) || "GET").toUpperCase();
    var bodyObj = null;
    if (method === "POST" && init && typeof init.body === "string" && /\/api\/tts(\b|-job)/.test(url)) {
      try { bodyObj = JSON.parse(init.body); } catch (e) {}
    }
    var res = await origFetch(input, init);
    try {
      if (method === "POST" && /\/api\/tts$/.test(url)) {
        var d = await res.clone().json();
        if (d && d.ok && (d.audio_url || d.mp3_url)) saveGeneration(bodyObj, d);
      } else if (method === "POST" && /\/api\/tts-job$/.test(url)) {
        var dj = await res.clone().json();
        if (dj && dj.job_id) jobPayloads[dj.job_id] = bodyObj;
      } else if (method === "GET" && /\/api\/tts-job\//.test(url)) {
        var ds = await res.clone().json();
        if (ds && ds.status === "done" && ds.result && (ds.result.audio_url || ds.result.mp3_url)) {
          var p = jobPayloads[ds.job_id]; delete jobPayloads[ds.job_id];
          saveGeneration(p, ds.result);
        }
      }
    } catch (e) { /* never break the app over save logic */ }
    return res;
  };

  async function saveGeneration(payload, result) {
    if (!user) return; // only persist for logged-in users
    payload = payload || {};
    try {
      var audioUrl = result.mp3_url || result.audio_url;
      var resp = await origFetch(audioUrl);
      var blob = await resp.blob();
      var filename = audioUrl.split("/").pop().split("?")[0];
      var objectPath = user.id + "/" + filename;
      var up = await sb.storage.from("audio").upload(objectPath, blob, { contentType: "audio/mpeg", upsert: true });
      if (up.error) throw up.error;
      var ins = await sb.from("generations").insert({
        user_id: user.id,
        text: payload.text || "",
        voice: result.voice || payload.voice || null,
        lang: result.lang || payload.lang || null,
        speed: result.speed != null ? result.speed : (payload.speed != null ? payload.speed : null),
        total_step: result.total_step != null ? result.total_step : (payload.total_step != null ? payload.total_step : null),
        duration: result.duration != null ? result.duration : null,
        audio_path: objectPath,
        mime: "audio/mpeg",
      });
      if (ins.error) throw ins.error;
      toast("라이브러리에 저장됨");
      if (historyOpen) loadHistory();
    } catch (e) {
      console.warn("[ttsstudio] save failed", e);
      toast("저장 실패: " + (e.message || e));
    }
  }

  // ---------------------------------------------------------------- init
  sb.auth.getUser().then(function (r) { user = (r.data && r.data.user) || null; renderAuth(); });
  sb.auth.onAuthStateChange(function (_e, session) {
    user = (session && session.user) || null;
    renderAuth();
    if (!user) { historyOpen = false; panel.classList.remove("open"); }
  });
})();
