import Link from "next/link";
import { API, STYLE, type TrendingRow } from "@/lib/api";
import Motion from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function Trending() {
  const rows: TrendingRow[] = await fetch(`${API}/trending`, { cache: "no-store" })
    .then(r => (r.ok ? r.json() : []))
    .catch(() => []);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-8">
      <Motion />
      <p data-rise className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Trending · last 7 days</p>
      <h1 data-split className="mt-3 max-w-4xl font-serif text-[clamp(3rem,8vw,6.5rem)] leading-[0.92]">What&apos;s going around <em>this week.</em></h1>
      <p data-rise className="mt-5 max-w-lg text-lg text-muted">The forwards people checked most. If one of these landed in your group, the answer is already here.</p>

      {rows.length === 0 && (
        <p data-rise className="mt-16 border-t border-line pt-8 font-serif text-3xl">
          Nothing checked yet this week. <Link href="/#check" className="text-signal underline underline-offset-4">Be the first →</Link>
        </p>
      )}

      <ol className="mt-14 border-b border-line">
        {rows.map((r, i) => {
          const s = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;
          return (
            <li key={r.id} data-rise>
              <Link href={`/r/${r.id}`} className="group grid grid-cols-[3.5rem_1fr] items-start gap-x-4 gap-y-3 border-t border-line py-7 transition-colors hover:bg-paper-2 sm:grid-cols-[6rem_1fr_auto] sm:px-4">
                <span className="font-serif text-5xl leading-none text-muted transition-colors group-hover:text-signal sm:text-6xl">{i + 1}</span>
                <div>
                  <p className="line-clamp-2 font-serif text-2xl leading-tight sm:text-[1.7rem]">{r.raw_text}</p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Checked {r.hit_count}× · open the proof →</p>
                </div>
                <span className="stamp col-start-2 justify-self-start text-xs sm:col-start-3 sm:self-center" style={{ "--c": s.color } as React.CSSProperties}>{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
