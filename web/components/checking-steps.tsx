"use client";
import { useEffect, useState } from "react";

const STAGES = [
  "Reading the message",
  "Splitting it into claims",
  "Searching fact-checkers & official sites",
  "Matching every quote to its source page",
  "Writing the verdict in your language",
];
const STAGE_AT = [2500, 5500, 11000, 15000]; // ms; rough match to real pipeline timings

/** Live progress while a check runs. Starts its clock on mount. */
export default function CheckingSteps({ className = "" }: { className?: string }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = STAGE_AT.map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <ol aria-live="polite" className={`space-y-1.5 font-mono text-xs ${className}`}>
      {STAGES.map((s, i) => (
        <li key={s} className={`flex items-center gap-2 transition-opacity ${i > stage ? "opacity-30" : ""}`}>
          <span className={`inline-block size-2 rounded-full ${i < stage ? "bg-ok" : i === stage ? "animate-pulse bg-signal" : "bg-muted"}`} />
          {s}{i < stage && " ✓"}
        </li>
      ))}
    </ol>
  );
}
