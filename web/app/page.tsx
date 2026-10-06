import Link from "next/link";
import CheckForm from "./check-form";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">FwdCheck 🔍</h1>
        <p className="mt-2 text-lg text-gray-700">Forward it to us before you forward it to family.</p>
        <p className="mt-1 text-sm text-gray-600">
          We split the message into claims, check each one against trusted, dated sources, and explain the answer in your language.
        </p>
      </header>

      <CheckForm initialError={error ? "Couldn't check the shared item. Please try again." : undefined} />

      <section className="mt-8 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-xl border border-gray-200 p-3"><b>🔬 Claim X-Ray</b><br />Every claim gets its own verdict.</div>
        <div className="rounded-xl border border-gray-200 p-3"><b>⏳ Time-Travel</b><br />Catches old news shared as new.</div>
        <div className="rounded-xl border border-gray-200 p-3"><b>📎 No source, no verdict</b><br />Every answer shows its proof.</div>
      </section>

      <nav className="mt-6 text-center">
        <Link href="/trending" className="font-medium text-blue-700 underline">🔥 See fakes going around this week</Link>
      </nav>
    </main>
  );
}
