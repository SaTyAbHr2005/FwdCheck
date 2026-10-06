import Link from "next/link";
import { notFound } from "next/navigation";
import { getResult, STYLE, TIER, FLAG, API } from "@/lib/api";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getResult(id);
  if (!r) notFound();
  const o = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <Link href="/" className="text-sm text-blue-700 underline">← Check another message</Link>

      <section className={`rounded-2xl border-2 p-4 ${o.cls}`}>
        <p className="text-3xl font-extrabold">{o.emoji} {o.label}</p>
        <p className="mt-2 whitespace-pre-line text-base">{r.summary}</p>
        {r.cached && <p className="mt-2 text-sm opacity-75">⚡ Already checked before: instant answer</p>}
        <audio controls preload="none" src={`${API}/check/${r.id}/voice.mp3`} className="mt-3 w-full" aria-label="Listen to the answer" />
        <a href={`/api/card/${r.id}`} download={`fwdcheck-${r.id.slice(0, 8)}.png`}
          className="mt-3 inline-block rounded-lg bg-black px-4 py-2 font-semibold text-white">
          ⬇ Download card to share
        </a>
      </section>

      <section>
        <h2 className="text-xl font-bold">🔬 Claim X-Ray</h2>
        {r.claims.length === 0 && <p className="mt-2 text-gray-700">No checkable facts in this message.</p>}
        <ul className="mt-3 space-y-4">
          {r.claims.map(c => {
            const s = STYLE[c.verdict] ?? STYLE.UNVERIFIABLE;
            return (
              <li key={c.claim_id} className={`rounded-xl border p-4 ${s.cls}`}>
                <p className="font-semibold">{s.emoji} {s.label}: <span className="font-normal">{c.claim}</span></p>
                {c.what_is_wrong && <p className="mt-1">❗ {c.what_is_wrong}</p>}
                {c.explanation && <p className="mt-1">{c.explanation}</p>}
                {c.timeline?.length > 0 && (
                  <ol className="mt-3 space-y-1 border-l-2 border-current pl-3 text-sm">
                    {c.timeline.map((t, i) => <li key={i}><b>{t.date}</b>: {t.event}</li>)}
                  </ol>
                )}
                {c.evidence.map((e, i) => (
                  <blockquote key={i} className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-gray-800">
                    “{e.quote}”
                    <span className="mt-1 block">
                      <a className="font-medium text-blue-700 underline" href={e.url} target="_blank" rel="noreferrer">
                        {e.source}{e.date ? `, ${e.date.slice(0, 10)}` : ""}
                      </a>{" "}· {TIER[e.tier] ?? e.tier}
                    </span>
                  </blockquote>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      {r.red_flags.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">🚩 Manipulation Radar</h2>
          <p className="text-sm text-gray-600">Tricks often used in fake forwards:</p>
          <ul className="mt-2 space-y-1">
            {r.red_flags.map((f, i) => (
              <li key={i} className="rounded-lg bg-orange-50 px-3 py-2"><b>{FLAG[f.type] ?? f.type}</b>: “{f.text}”</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold">Original message</h2>
        <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm">{r.text}</p>
      </section>
    </main>
  );
}
