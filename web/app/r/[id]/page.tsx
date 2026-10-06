import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getResult, STYLE, TIER, FLAG, API, type Result } from "@/lib/api";
import Motion from "@/components/motion";

const LANG: Record<string, string> = { hi: "Hindi", mr: "Marathi", en: "English", hinglish: "Hinglish" };
const tint = (color: string) => ({ "--c": color }) as React.CSSProperties;

// Wrap each red-flag phrase found in the original text with a marked span.
function highlight(text: string, flags: Result["red_flags"]) {
  const lower = text.toLowerCase();
  const hits = flags
    .map(f => ({ f, at: f.text.length > 2 ? lower.indexOf(f.text.toLowerCase()) : -1 }))
    .filter(h => h.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const { f, at } of hits) {
    if (at < pos) continue; // overlapping phrase, keep the first
    out.push(text.slice(pos, at));
    out.push(
      <mark key={at} className="flagged bg-transparent text-inherit" title={FLAG[f.type] ?? f.type}>
        {text.slice(at, at + f.text.length)}
        <sup className="ml-0.5 font-mono text-[10px] text-signal">⚑ {FLAG[f.type] ?? f.type}</sup>
      </mark>,
    );
    pos = at + f.text.length;
  }
  out.push(text.slice(pos));
  return out;
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getResult(id);
  if (!r) notFound();
  const o = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;

  const h = await headers();
  const self = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}/r/${r.id}`;
  const waText = `${o.label.toUpperCase()}: ${r.summary}\n\nProof: ${self}`;

  const counts = Object.entries(
    r.claims.reduce<Record<string, number>>((m, c) => ({ ...m, [c.verdict]: (m[c.verdict] ?? 0) + 1 }), {}),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-8">
      <Motion />
      <div data-rise className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <Link href="/#check" className="text-ink hover:text-signal">← New check</Link>
        <span>
          Check № {r.id.slice(0, 8)} · {r.input_type} · {LANG[r.language] ?? r.language}
          {r.cached && <span className="text-signal"> · instant repeat</span>}
        </span>
      </div>

      {/* Verdict */}
      <section className="grid gap-10 py-12 lg:grid-cols-12" data-shake>
        <div className="lg:col-span-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Verdict</p>
          <p data-stamp className="stamp mt-6 max-w-full text-[clamp(1.5rem,2.8vw,2.4rem)]" style={tint(o.color)}>{o.label}</p>
          {counts.length > 0 && (
            <div className="mt-10">
              <div className="flex h-2 overflow-hidden rounded-full bg-paper-2">
                {counts.map(([v, n]) => (
                  <div key={v} data-bar style={{ width: `${(n / r.claims.length) * 100}%`, background: STYLE[v]?.color }} />
                ))}
              </div>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                {counts.map(([v, n]) => (
                  <span key={v} className="flex items-center gap-1.5">
                    <i className="inline-block size-2 rounded-full" style={{ background: STYLE[v]?.color }} />
                    {n} {STYLE[v]?.label ?? v}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          {/* Line-mask splitting clips Devanagari matras, so non-English summaries just fade in, in sans. */}
          <p data-rise className={`whitespace-pre-line ${r.language === "en"
            ? "font-serif text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.12]"
            : "text-[clamp(1.35rem,2.4vw,1.9rem)] leading-[1.5]"}`}>{r.summary}</p>
          <div data-rise className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <audio controls preload="none" src={`${API}/check/${r.id}/voice.mp3`} className="h-11 w-full sm:max-w-xs" aria-label="Listen to the answer" />
            <a href={`/api/card/${r.id}`} download={`fwdcheck-${r.id.slice(0, 8)}.png`}
              className="rounded-full border border-ink px-5 py-2.5 text-center text-[15px] transition-colors hover:bg-ink hover:text-paper">
              Download card ↓
            </a>
            <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"
              className="rounded-full bg-ink px-5 py-2.5 text-center text-[15px] text-paper transition-colors hover:bg-signal">
              Send to the group ↗
            </a>
          </div>
        </div>
      </section>

      {/* Claim X-Ray */}
      <section className="border-t border-line pt-10">
        <h2 data-rise className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Claim X-Ray · {r.claims.length} {r.claims.length === 1 ? "claim" : "claims"}</h2>
        {r.claims.length === 0 && <p data-rise className="mt-6 font-serif text-3xl">No checkable facts in this message.</p>}
        <ol className="mt-4">
          {r.claims.map((c, i) => {
            const s = STYLE[c.verdict] ?? STYLE.UNVERIFIABLE;
            return (
              <li key={c.claim_id} data-rise className="grid gap-6 border-b border-line py-10 lg:grid-cols-12">
                <div className="flex items-start justify-between gap-4 lg:col-span-4 lg:flex-col">
                  <span className="font-mono text-xs text-muted">C{i + 1}</span>
                  <span className="stamp text-base" style={tint(s.color)}>{s.label}</span>
                  {c.confidence > 0 && (
                    <div className="hidden w-full max-w-[12rem] lg:block">
                      <div className="h-px bg-line"><div data-bar className="h-px" style={{ width: `${Math.round(c.confidence * 100)}%`, background: s.color }} /></div>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Confidence {Math.round(c.confidence * 100)}%</p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8">
                  <p className="font-serif text-3xl leading-tight">{c.claim}</p>
                  {c.what_is_wrong && <p className="mt-3 text-lg leading-snug text-signal">{c.what_is_wrong}</p>}
                  {c.explanation && <p className="mt-3 text-[17px] leading-relaxed text-muted">{c.explanation}</p>}

                  {c.timeline?.length > 0 && (
                    <ol className="mt-6 space-y-3 border-l border-line pl-5">
                      {c.timeline.map((t, k) => (
                        <li key={k} className="relative">
                          <i className="absolute -left-[23.5px] top-1.5 size-2 rounded-full border border-ink bg-paper" />
                          <span className="font-mono text-xs text-muted">{t.date}</span>
                          <p className="text-[15px]">{t.event}</p>
                        </li>
                      ))}
                    </ol>
                  )}

                  {c.evidence.map((e, k) => (
                    <figure key={k} className="mt-6 border-l-2 pl-5" style={{ borderColor: s.color }}>
                      <blockquote className="font-serif text-xl italic leading-snug">“{e.quote}”</blockquote>
                      <figcaption className="mt-2 flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                        <a href={e.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-4 hover:text-signal">{e.source} ↗</a>
                        <span>{TIER[e.tier] ?? e.tier}</span>
                        {e.date && <span>{e.date.slice(0, 10)}</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Original + Manipulation Radar */}
      <section className="grid gap-8 pt-14 lg:grid-cols-12">
        <div data-rise className="lg:col-span-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
            {r.red_flags.length > 0 ? "Manipulation Radar" : "Original message"}
          </h2>
          {r.red_flags.length > 0 && (
            <>
              <p className="mt-3 text-[15px] leading-snug text-muted">Tricks this forward uses to make you share it without thinking.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {[...new Set(r.red_flags.map(f => f.type))].map(t => (
                  <li key={t} className="rounded-full border border-signal/50 px-3 py-1 font-mono text-[11px] text-signal">⚑ {FLAG[t] ?? t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div data-rise className="rounded-[18px] rounded-tl-sm border border-line bg-paper-2 p-6 lg:col-span-8">
          <p className="mb-2 font-mono text-[11px] italic text-muted">↪ Forwarded many times</p>
          <p className="whitespace-pre-line text-[17px] leading-[1.9]">{highlight(r.text, r.red_flags)}</p>
        </div>
      </section>
    </main>
  );
}
