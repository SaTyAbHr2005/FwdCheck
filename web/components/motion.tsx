"use client";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";

/**
 * Drop once per page. Animates by data attribute so pages stay server components:
 *   data-split  heading: lines slide up out of a mask
 *   data-rise   fades up when scrolled into view (batched, staggered)
 *   data-stamp  slams down like a rubber stamp
 *   data-bar    width grows from 0 to its inline width
 */
export default function Motion() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>("[data-split]").forEach(el => {
        SplitText.create(el, {
          type: "lines", mask: "lines", autoSplit: true,
          onSplit: s => gsap.from(s.lines, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.08, delay: 0.1 }),
        });
      });

      gsap.set("[data-rise]", { autoAlpha: 0, y: 28 });
      ScrollTrigger.batch("[data-rise]", {
        start: "top 92%", once: true,
        onEnter: els => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 }),
      });

      gsap.utils.toArray<HTMLElement>("[data-stamp]").forEach(el => {
        gsap.from(el, {
          scale: 2.4, autoAlpha: 0, rotate: -18, duration: 0.45, ease: "power4.in", delay: 0.5,
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onComplete: () => gsap.fromTo(el.closest("[data-shake]") ?? el, { x: -3 }, { x: 0, duration: 0.3, ease: "elastic.out(1,0.3)" }),
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-bar]").forEach(el => {
        gsap.from(el, { width: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 95%", once: true } });
      });
      // Don't wait for window "load" (fonts, audio, WebGL) before revealing what's already on screen.
      ScrollTrigger.refresh();
    });
    document.documentElement.classList.remove("motion");

    // Arriving at /#how from another page: the browser jumped to the section before the pinned sections
    // (X-Ray, pipeline) added their scroll space, leaving the reader mid-animation. Jump again once they exist.
    const frame = requestAnimationFrame(() => {
      const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target) return;
      ScrollTrigger.refresh();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 64 });   // 64 = fixed header
    });
    return () => cancelAnimationFrame(frame);
  });
  return null;
}
