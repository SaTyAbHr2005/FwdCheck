"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const STAGES = [
  ["Reading the message", "Text, screenshot, voice note or PDF: turning it into words."],
  ["Splitting it into claims", "One forward often mixes true, false and old claims."],
  ["Searching trusted sources", "Fact-checkers, official sites and major news, with dates."],
  ["Matching quotes to their pages", "If a quote isn't on the source page, it doesn't count."],
  ["Writing your verdict", "In the language the forward was written in."],
] as const;
const STAGE_AT = [2500, 5500, 11000, 15000]; // ms; rough match to real pipeline timings
const PROGRESS = [10, 28, 52, 74, 90];       // % of the top bar per stage; never 100 until the result opens

const TIPS = [
  "Old news is the most common fake: a true story from years ago, shared as today's.",
  "“Forward to 10 groups” is a pressure trick. Real alerts don't need you to rush.",
  "Official schemes are announced on .gov.in sites, not through WhatsApp links.",
  "A screenshot of a news channel is easy to fake. Look for the story on the channel's own site.",
];

export type Submitted = { text?: string; file?: File | null };

function kindOf(f: File) {
  if (f.type.startsWith("image/")) return "Screenshot";
  if (f.type.startsWith("audio/")) return "Voice note";
  if (f.type === "application/pdf") return "PDF";
  return "File";
}

const noop = () => () => {};

/** Full-screen, blocking "checking" screen. The rest of the page is inert until it unmounts. */
export default function CheckingScreen({ submitted, kicker = "Checking your forward" }: { submitted?: Submitted; kicker?: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setMs(Date.now() - t0), 250);
    return () => clearInterval(id);
  }, []);

  // Phones auto-lock after ~30 s and a locked phone can drop the request: keep the screen on while checking.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock?.request("screen").then(l => { lock = l; }, () => {});
    return () => { lock?.release().catch(() => {}); };
  }, []);

  // Block the page behind: no clicks, no tabbing, no scrolling.
  useEffect(() => {
    if (!mounted) return;
    const root = document.getElementById("checking-screen");
    const others = [...document.body.children].filter(el => el !== root && !el.hasAttribute("inert"));
    others.forEach(el => el.setAttribute("inert", ""));
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      others.forEach(el => el.removeAttribute("inert"));
      html.style.overflow = overflow;
    };
  }, [mounted]);

  const file = submitted?.file;
  const [imageFailed, setImageFailed] = useState(false);       // e.g. HEIC photos on Android Chrome
  const isImage = !!file?.type.startsWith("image/") && !imageFailed;
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {                                   // screenshot preview; the URL lives only while shown
    if (!file || !isImage || !img.current) return;
    const url = URL.createObjectURL(file);
    img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isImage, mounted]);

  if (!mounted) return null;
  const stage = STAGE_AT.filter(t => ms >= t).length;
  const secs = Math.floor(ms / 1000);
  const text = submitted?.text?.trim();

  return createPortal(
    <div id="checking-screen" role="dialog" aria-modal="true" aria-labelledby="checking-title" data-lenis-prevent
      className="fixed inset-0 z-[55] overflow-y-auto overscroll-contain bg-paper text-ink">
      {/* progress rule along the top */}
      <div className="fixed inset-x-0 top-0 h-[3px] bg-line">
        <div className="h-full bg-signal transition-[width] duration-[2500ms] ease-out" style={{ width: `${PROGRESS[stage]}%` }} />
      </div>

      <div className="mx-auto grid min-h-full max-w-6xl content-center gap-10 px-4 py-14 sm:px-8 lg:grid-cols-12 lg:gap-14">
        <header className="lg:col-span-12">
          <div className="flex items-center justify-between border-b border-line pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-signal" />
              {kicker}
            </span>
            <span aria-hidden className="tabular-nums">{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</span>
          </div>
        </header>

        {/* what's being checked, under the scanner */}
        <figure className="order-last lg:order-none lg:col-span-5">
          <div className="relative overflow-hidden rounded-[22px] border border-line bg-paper-2 p-2 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.35)]">
            <div className="relative min-h-44 rounded-[16px] bg-paper p-5">
              <p className="flex items-center gap-1.5 font-mono text-[11px] italic text-muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l6 6-6 6M21 12H9a6 6 0 0 0-6 6" /></svg>
                Forwarded many times
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise */}
              {isImage && <img ref={img} alt="" onError={() => setImageFailed(true)} className="mt-3 max-h-56 w-full rounded-lg object-cover object-top opacity-90" />}
              {file && !isImage && (
                <p className="mt-4 inline-flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">{kindOf(file)}</span>
                  <span className="max-w-[16rem] truncate text-[15px]">{file.name}</span>
                </p>
              )}
              {text && <p className="mt-3 line-clamp-5 whitespace-pre-line text-[17px] leading-relaxed">{text}</p>}
              {!text && !file && <p className="mt-3 text-[17px] text-muted">Your forward</p>}
              <span className="stamp absolute right-4 top-4 text-[10px] opacity-70" style={{ "--c": "var(--muted)" } as React.CSSProperties}>Checking</span>
            </div>
            <div aria-hidden className="scan pointer-events-none absolute inset-0" />
          </div>
          <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Every claim gets its own verdict and source</figcaption>
        </figure>

        <section className="lg:col-span-7" aria-live="polite">
          <h1 id="checking-title" key={stage} className="rise font-serif text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[0.95]">
            {STAGES[stage][0]}<span className="text-signal">…</span>
          </h1>
          <p key={`d${stage}`} className="rise mt-4 max-w-lg text-lg leading-snug text-muted">{STAGES[stage][1]}</p>

          <ol className="mt-10 border-b border-line">
            {STAGES.map(([s], i) => (
              <li key={s} className={`grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2 border-t border-line py-3 transition-opacity duration-500 ${i > stage ? "opacity-35" : ""}`}>
                <span className={`font-mono text-xs ${i === stage ? "text-signal" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[17px]">{s}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                  {i < stage ? <span className="text-ok">Done ✓</span> : i === stage ? <span className="text-signal">Working</span> : <span className="text-muted">Next</span>}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-lg text-[15px] leading-snug text-muted">
            {secs >= 30
              ? "Taking longer than usual: the server may be waking up or the AI is busy. It retries on its own, please keep this screen open."
              : <><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">While you wait · </span>{TIPS[Math.floor(secs / 7) % TIPS.length]}</>}
          </p>
        </section>
      </div>
    </div>,
    document.body,
  );
}
