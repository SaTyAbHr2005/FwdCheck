"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { STYLE } from "@/lib/api";

// A real, sourced example (RBI press releases, 2023) used to show the idea, not live output.
const CLAIMS = [
  { text: "RBI is withdrawing ₹2000 notes.", verdict: "OUTDATED", why: "Announced on 19 May 2023. Old news shared as new.", date: "2023-05-19" },
  { text: "They stop being legal tender from tomorrow.", verdict: "FALSE", why: "RBI said the ₹2000 note continues to be legal tender.", date: "2023-05-19" },
  { text: "Banks will exchange them only till Friday.", verdict: "FALSE", why: "Bank exchange closed on 7 Oct 2023. Now only at RBI issue offices.", date: "2023-10-09" },
];

export default function XRayDemo() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    const build = (tl: gsap.core.Timeline) => {
      tl.fromTo(q(".scan"), { top: "0%", autoAlpha: 1 }, { top: "100%", duration: 4, ease: "none" }, 0)
        .to(q(".scan"), { autoAlpha: 0, duration: 0.3 });
      q(".flag").forEach((f, i) => tl.to(f, { textDecorationColor: "var(--signal)", duration: 0.3 }, i === 0 ? 0.3 : 3.6));
      q(".flag-tag").forEach((f, i) => tl.from(f, { autoAlpha: 0, y: 6, duration: 0.3 }, i === 0 ? 0.4 : 3.7));
      q(".claim").forEach((c, i) => {
        const at = 0.9 + i * 0.95;
        tl.to(c, { backgroundSize: "100% 100%", duration: 0.5 }, at)
          .from(q(".row")[i], { autoAlpha: 0, x: 60, duration: 0.6, ease: "power3.out" }, at + 0.2)
          .from(q(".row .stamp")[i], { autoAlpha: 0, scale: 2.2, duration: 0.3, ease: "power4.in" }, at + 0.6);
      });
      return tl;
    };
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      build(gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "+=1600", pin: true, scrub: 0.6 } }));
    });
    mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
      build(gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 60%", once: true } })).timeScale(1.6);
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { gsap.set(q(".claim"), { backgroundSize: "100% 100%" }); gsap.set(q(".scan"), { autoAlpha: 0 }); });
  }, { scope: root });

  return (
    <div ref={root} className="mx-auto grid min-h-dvh max-w-7xl content-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-0">
      <div className="lg:col-span-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Fig. 2 · Claim X-Ray</p>
        <h2 className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] sm:text-7xl">One forward. <em>Three</em> claims. Three different answers.</h2>
      </div>

      <div className="lg:col-span-5">
        <div className="relative overflow-hidden rounded-[18px] rounded-tl-sm border border-line bg-paper-2 p-5 text-[19px] leading-[1.7]">
          <p className="mb-2 font-mono text-[11px] italic text-muted">↪ Forwarded many times</p>
          <p>
            🚨 <span className="flag relative" style={{ textDecoration: "underline wavy transparent", textUnderlineOffset: 4 }}>URGENT<span className="flag-tag absolute -top-5 left-0 whitespace-nowrap font-mono text-[10px] not-italic text-signal">⚑ urgency</span></span>:{" "}
            {CLAIMS.map(c => <span key={c.text}><span className="claim marker">{c.text}</span>{" "}</span>)}
            <span className="flag relative" style={{ textDecoration: "underline wavy transparent", textUnderlineOffset: 4 }}>Forward to every group you are in!<span className="flag-tag absolute -bottom-5 left-0 whitespace-nowrap font-mono text-[10px] text-signal">⚑ chain-forward</span></span>
          </p>
          <p className="mt-6 text-right font-mono text-[10px] text-muted">10:42 ✓✓</p>
          <div className="scan pointer-events-none absolute inset-x-0 h-10 -translate-y-1/2 border-b-2 border-signal bg-gradient-to-b from-transparent to-signal/15" />
        </div>
      </div>

      <ol className="space-y-3 lg:col-span-7">
        {CLAIMS.map((c, i) => {
          const s = STYLE[c.verdict];
          return (
            <li key={c.text} className="row grid grid-cols-[auto_1fr_auto] items-start gap-4 border-t border-line pt-4">
              <span className="font-mono text-xs text-muted">C{i + 1}</span>
              <div>
                <p className="font-serif text-2xl leading-tight">{c.text}</p>
                <p className="mt-1 text-[15px] text-muted">{c.why}</p>
                <p className="mt-2 font-mono text-[11px] text-muted">rbi.org.in · Official · {c.date}</p>
              </div>
              <span className="stamp text-sm" style={{ "--c": s.color } as React.CSSProperties}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
