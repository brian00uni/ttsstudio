import { useState, useRef, useEffect } from "react";
import { VOICES } from "../lib/tts";

// Custom dropdown that shows a per-voice avatar in the trigger AND in each
// option (native <select> can't render images).
export default function VoiceSelect({ value, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = VOICES.find((v) => v.id === value) || VOICES[0];

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const males = VOICES.filter((v) => v.id.startsWith("M"));
  const females = VOICES.filter((v) => v.id.startsWith("F"));

  function pick(id) { onChange(id); setOpen(false); }

  function Row({ v }) {
    const active = v.id === value;
    return (
      <button type="button" onClick={() => pick(v.id)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>
        <img src={v.img} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200" />
        <span>{v.name}</span>
        {active && <span className="ml-auto text-brand-600">✓</span>}
      </button>
    );
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none hover:border-slate-400 focus:border-brand-500">
        <img src={current.img} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200" />
        <span className="font-medium text-slate-800">{current.name}</span>
        <span className="ml-auto text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-400">남성</div>
          {males.map((v) => <Row key={v.id} v={v} />)}
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-400">여성</div>
          {females.map((v) => <Row key={v.id} v={v} />)}
        </div>
      )}
    </div>
  );
}
