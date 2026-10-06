import Link from "next/link";
import { API, STYLE, type TrendingRow } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Trending() {
  const rows: TrendingRow[] = await fetch(`${API}/trending`, { cache: "no-store" })
    .then(r => (r.ok ? r.json() : []))
    .catch(() => []);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/" className="text-sm text-blue-700 underline">← Check a message</Link>
      <h1 className="mt-3 text-3xl font-extrabold">🔥 Fakes going around this week</h1>
      <p className="text-gray-600">Most-checked forwards in the last 7 days.</p>
      {rows.length === 0 && <p className="mt-6 text-gray-700">Nothing checked yet this week.</p>}
      <ol className="mt-4 space-y-3">
        {rows.map((r, i) => {
          const s = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;
          return (
            <li key={r.id} className={`rounded-xl border p-3 ${s.cls}`}>
              <Link href={`/r/${r.id}`} className="block">
                <b>#{i + 1} {s.emoji} {s.label}</b> · checked {r.hit_count}×
                <p className="mt-1 line-clamp-2 text-sm">{r.raw_text}</p>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
