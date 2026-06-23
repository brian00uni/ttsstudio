import { useState } from "react";
import { supabase, toEmail } from "../lib/supabase";

// Shared general-purpose account, prefilled as placeholders and used when the
// login form is submitted empty (just press Enter).
const DEFAULT_ID = "user";
const DEFAULT_PW = "112233";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  // Placeholders clear on focus, restore on blur (when still empty).
  const [idFocused, setIdFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(""); setOk(false);

    // Login mode: empty form -> sign in as the shared "user" account.
    let id = identifier.trim();
    let pw = password;
    if (mode === "login" && !id && !pw) { id = DEFAULT_ID; pw = DEFAULT_PW; }

    const email = toEmail(id);
    if (!email || !pw) { setMsg("아이디와 비밀번호를 입력하세요."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { data: { username: id } },
        });
        if (error) throw error;
        if (!data.session) {
          setOk(true);
          setMsg("확인 메일을 보냈습니다. 메일의 링크 클릭 후 로그인하세요.");
        }
      }
      // On success, AuthContext + routing redirect automatically.
    } catch (err) {
      setMsg(translate(err.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <img src="/tts-studio-logo.png" alt="TTS STUDIO" className="mx-auto w-48 max-w-full" />
          <p className="mt-3 text-sm text-slate-500">AI 음성으로 콘텐츠를 만들어 보세요</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            placeholder={mode === "login" && !idFocused ? DEFAULT_ID : "아이디 또는 이메일"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onFocus={() => setIdFocused(true)}
            onBlur={() => setIdFocused(false)}
          />
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            placeholder={mode === "login" && !pwFocused ? DEFAULT_PW : "비밀번호"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPwFocused(true)}
            onBlur={() => setPwFocused(false)}
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>
        {msg && (
          <p className={`mt-3 text-center text-xs ${ok ? "text-green-600" : "text-red-500"}`}>{msg}</p>
        )}
        {mode === "login" && (
          <p className="mt-3 text-center text-xs text-slate-400">
            그냥 <span className="font-medium text-slate-500">Enter</span>를 누르면 공용 계정(user)으로 로그인됩니다.
          </p>
        )}
        <div className="mt-5 text-center text-xs text-slate-500">
          {mode === "login" ? (
            <button onClick={() => { setMode("signup"); setMsg(""); }} className="font-semibold text-brand-600">
              계정이 없나요? 회원가입
            </button>
          ) : (
            <button onClick={() => { setMode("login"); setMsg(""); }} className="font-semibold text-brand-600">
              이미 계정이 있나요? 로그인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function translate(m) {
  if (/Invalid login/i.test(m)) return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (/already registered/i.test(m)) return "이미 가입된 아이디입니다.";
  if (/at least 6/i.test(m)) return "비밀번호는 6자 이상이어야 합니다.";
  return m;
}
