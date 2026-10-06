import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col items-start justify-center gap-6 px-4 sm:px-8">
      <span className="stamp text-lg" style={{ "--c": "var(--grey)" } as React.CSSProperties}>Cannot be confirmed</span>
      <h1 className="font-serif text-6xl leading-[0.95]">We couldn&apos;t find that page.</h1>
      <p className="text-lg text-muted">The link may be wrong, or the check was removed.</p>
      <Link href="/#check" className="rounded-full bg-ink px-6 py-3 text-paper hover:bg-signal">Check a forward →</Link>
    </main>
  );
}
