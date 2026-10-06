import Link from "next/link";
import CheckForm from "./check-form";
import ForwardGlobe from "@/components/forward-globe";
import XRayDemo from "@/components/xray-demo";
import Pipeline from "@/components/pipeline";
import Motion from "@/components/motion";
import { STYLE } from "@/lib/api";

// Kinds of forwards people send us (illustrative headlines, not live data).
const TICKER = [
  ["RBI bans ₹2000 notes from tomorrow", "OUTDATED"],
  ["Hot lemon water cures cancer", "FALSE"],
  ["Free laptop for every student, register at this link", "FALSE"],
  ["WhatsApp will charge for every message from Monday", "FALSE"],
  ["Govt scheme gives free rooftop solar to all", "PARTLY_TRUE"],
  ["New ₹1000 note launched next week", "FALSE"],
] as const;

const FEATURES = [
  ["Time-Travel Check", "Compares the claim with the publish date of every source. A true story from 2019 shared as today's news gets called Outdated."],
  ["Voice in, voice out", "Send a voice note in Hindi or Marathi. Get the answer back as a voice note, for people who don't read long texts."],
  ["Rebuttal card", "A clean image with the verdict and sources, made to be posted straight back into the family group."],
  ["Manipulation Radar", "Flags the tricks: urgency, fear, fake authority, miracle cures, chain-forward pressure, suspicious links."],
  ["Instant repeats", "The same fake goes round a thousand groups. Once checked, every repeat is answered in under a second."],
  ["Wherever you are", "WhatsApp, Telegram, this website, or Android's Share menu. Same engine, same proof."],
];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main>
      <Motion />

      {/* Hero */}
      <section id="check" className="relative mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-7xl items-center gap-8 px-4 pb-16 pt-8 sm:px-8 lg:grid-cols-12">
        {/* Globe and its legend share one box, so the legend stays centred under the sphere. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-50 lg:inset-y-0 lg:left-[50%] lg:right-[clamp(-12rem,calc((80rem-100vw)/2),0px)] lg:h-auto lg:opacity-100">
          <ForwardGlobe className="absolute inset-0" />
          <p aria-hidden className="absolute inset-x-0 bottom-6 hidden justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted lg:flex">
            <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-signal" />False</span>
            <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-ok" />True</span>
            <span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-muted" />Not checked yet</span>
          </p>
        </div>

        <div className="relative lg:col-span-6">
          <p data-rise className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="mr-2 inline-block size-1.5 -translate-y-px rounded-full bg-signal align-middle" />
            Is this forward true?
          </p>
          <h1 data-split className="mt-5 font-serif text-[clamp(3rem,6.2vw,5.6rem)] leading-[0.92] tracking-[-0.01em]">
            Forward it to us <em className="text-signal">before</em> you forward it to family.
          </h1>
          <p data-rise className="mt-5 max-w-lg text-lg leading-snug text-muted">
            FwdCheck splits a forward into its claims, checks each one against trusted, dated sources, and answers in Hindi, Marathi or English. With the proof attached.
          </p>
          <div data-rise className="mt-7 max-w-xl">
            <CheckForm initialError={error ? "Couldn't check the shared item. Please try again." : undefined} />
          </div>
        </div>
      </section>

      {/* Ticker */}
      <section aria-label="Kinds of forwards we check" className="overflow-hidden border-y border-line bg-paper-2 py-4">
        <div className="ticker flex w-max gap-12">
          {[...TICKER, ...TICKER].map(([t, v], i) => (
            <span key={i} className="flex items-center gap-4 whitespace-nowrap font-serif text-2xl" aria-hidden={i >= TICKER.length}>
              {t}
              <span className="stamp text-[10px]" style={{ "--c": STYLE[v].color } as React.CSSProperties}>{STYLE[v].label}</span>
              <span className="text-muted">✶</span>
            </span>
          ))}
        </div>
      </section>

      <section aria-label="Claim X-Ray example"><XRayDemo /></section>

      <section id="how" aria-label="How it works"><Pipeline /></section>

      {/* Features: editorial index */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <p data-rise className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Index</p>
        <h2 data-split className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] sm:text-7xl">Built for the family group, not the fact-check desk.</h2>
        <ol className="mt-14 border-b border-line">
          {FEATURES.map(([t, d], i) => (
            <li key={t} data-rise className="group grid gap-2 border-t border-line py-7 transition-colors hover:bg-ink hover:text-paper sm:grid-cols-12 sm:items-baseline sm:px-4">
              <span className="font-mono text-xs text-muted group-hover:text-signal sm:col-span-1">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-serif text-3xl transition-transform duration-500 group-hover:translate-x-2 sm:col-span-4 sm:text-4xl">{t}</h3>
              <p className="max-w-xl text-[17px] leading-snug text-muted group-hover:text-paper/75 sm:col-span-7">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Rule */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-8 lg:grid-cols-2">
          <p data-split className="font-serif text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.95]">
            No source, <em className="text-signal">no verdict.</em>
          </p>
          <div data-rise className="space-y-4 self-end text-lg leading-snug text-muted">
            <p>AI can sound sure and still be wrong. So FwdCheck never trusts its own words: every quote it shows is matched against the real source page in code.</p>
            <p>If the quote isn&apos;t on the page, the claim is marked <span className="text-ink">Cannot be confirmed</span>. You always see where the answer came from, and when it was published.</p>
            <Link href="/trending" className="inline-block pt-2 font-mono text-xs uppercase tracking-[0.14em] text-ink underline decoration-signal underline-offset-4 hover:text-signal">
              See the fakes going around this week →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-signal text-[#141311]">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-20 sm:px-8 md:flex-row md:items-end md:justify-between">
          <h2 data-split className="max-w-3xl font-serif text-[clamp(2.8rem,7vw,6rem)] leading-[0.92]">Got a forward this morning?</h2>
          <Link href="/#check" className="rounded-full bg-[#141311] px-7 py-4 text-lg text-[#f1ece1] transition-transform hover:-translate-y-1">Check it now →</Link>
        </div>
      </section>
    </main>
  );
}
