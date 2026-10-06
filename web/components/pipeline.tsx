"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const STEPS = [
  { t: "Read", d: "Screenshots, voice notes, PDFs and links become plain text. Hindi, Marathi, English or Hinglish.", s: "Gemini Flash-Lite · PyMuPDF · trafilatura" },
  { t: "Split", d: "The forward is cut into separate, checkable claims. The manipulation radar marks the tricks.", s: "Structured JSON · rule-based radar" },
  { t: "Search", d: "Google Fact Check first. Then trusted sites only: government, fact-checkers, established news.", s: "Fact Check Tools API · web search · allowlist" },
  { t: "Judge", d: "Every claim is weighed against dated evidence. Old news shared as new is called out as Outdated.", s: "Time-Travel Check" },
  { t: "Guard", d: "Each quote must appear word for word on the real source page. No match, no verdict.", s: "String-match guardrail in code" },
  { t: "Reply", d: "The answer comes back in your language, as text, a voice note and a card you can post in the group.", s: "edge-tts neural voices · OG image card" },
];

export default function Pipeline() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const distance = () => track.current!.scrollWidth - innerWidth;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true },
      });
      tl.to(track.current, { x: () => -distance(), ease: "none" }, 0)
        .fromTo(".pipe-progress", { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
    });
  }, { scope: root });

  return (
    <div ref={root} className="overflow-hidden bg-ink text-paper md:h-dvh">
      <div className="flex h-full flex-col justify-center py-20 md:py-0">
        <div className="mx-auto mb-10 w-full max-w-7xl px-4 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Fig. 3 · The pipeline</p>
          <h2 className="mt-3 max-w-2xl font-serif text-5xl leading-[0.95] sm:text-7xl">Six steps between a rumour and the truth.</h2>
          <div className="mt-8 hidden h-px bg-paper/20 md:block"><div className="pipe-progress h-px origin-left bg-signal" /></div>
        </div>
        <ol ref={track} className="flex flex-col gap-10 px-4 sm:px-8 md:w-max md:flex-row md:gap-0 md:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
          {STEPS.map((x, i) => (
            <li key={x.t} className="md:w-[30rem] md:border-l md:border-paper/20 md:px-10">
              <span className="font-serif text-[7rem] leading-none text-transparent [-webkit-text-stroke:1px_var(--paper)] md:text-[10rem]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-serif text-4xl italic">{x.t}</h3>
              <p className="mt-3 max-w-sm text-lg leading-snug text-paper/75">{x.d}</p>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-signal">{x.s}</p>
            </li>
          ))}
          <li aria-hidden className="hidden md:block md:w-[20vw]" />
        </ol>
      </div>
    </div>
  );
}
