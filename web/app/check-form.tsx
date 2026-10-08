"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postCheck } from "@/lib/api";
import CheckingScreen from "@/components/checking-screen";

const EXAMPLES = [
  { label: "₹2000 notes", text: "🚨 URGENT: RBI has announced ₹2000 notes will stop being legal tender from tomorrow. Banks will exchange them only till Friday. Forward to every group you are in!" },
  { label: "Lemon cure", text: "Drinking hot lemon water every morning kills cancer cells, confirms WHO. Doctors don't want you to know. Share with everyone you love 🙏" },
];

export default function CheckForm({ initialError }: { initialError?: string }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState(initialError ?? "");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const fd = new FormData();
    if (text.trim()) fd.append("text", text.trim());
    if (file) fd.append("file", file);
    try {
      router.push(`/r/${await postCheck(fd)}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  return (
    <form onSubmit={submit} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
      className={`relative rounded-[22px] border bg-paper-2 p-2 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.35)] transition-colors ${drag ? "border-signal" : "border-line"}`}>
      <div className="rounded-[16px] bg-paper p-4">
        <p className="flex items-center gap-1.5 font-mono text-[11px] italic text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l6 6-6 6M21 12H9a6 6 0 0 0-6 6" /></svg>
          Forwarded many times
        </p>
        <label htmlFor="msg" className="sr-only">Paste the forwarded message or a link</label>
        <textarea id="msg" value={text} onChange={e => setText(e.target.value)} rows={5} disabled={busy}
          className="mt-2 w-full resize-none bg-transparent text-[17px] leading-relaxed placeholder:text-muted/70 focus:outline-none"
          placeholder="Paste the forward or a link here…" />
        {file && (
          <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-xs">
            📎 {file.name}
            <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="text-muted hover:text-signal">✕</button>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-3">
        <label className="cursor-pointer rounded-full border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider hover:border-ink">
          + Screenshot · voice · PDF
          <input type="file" accept="image/*,audio/*,application/pdf,.opus,.ogg,.m4a,.heic,.heif,text/plain,.txt" className="sr-only" disabled={busy}
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <span className="hidden font-mono text-[11px] text-muted sm:inline">or drop a file</span>
        <button disabled={busy || (!text.trim() && !file)}
          className="group ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-paper transition-colors hover:bg-signal disabled:opacity-30 disabled:hover:bg-ink">
          {busy ? "Checking…" : "Check it"}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </div>

      {!busy && !text && !file && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2 pt-2 font-mono text-[11px] text-muted">
          Try:
          {EXAMPLES.map(x => (
            <button key={x.label} type="button" onClick={() => setText(x.text)} className="underline decoration-dotted underline-offset-4 hover:text-signal">
              {x.label}
            </button>
          ))}
        </div>
      )}

      {busy && <CheckingScreen submitted={{ text, file }} />}

      {err && <p role="alert" className="mx-2 mb-2 mt-3 rounded-xl border border-signal/40 px-3 py-2 text-sm text-signal">{err}</p>}
    </form>
  );
}
