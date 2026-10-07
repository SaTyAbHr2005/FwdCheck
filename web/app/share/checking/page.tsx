"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fromShare, postCheck } from "@/lib/api";
import CheckingScreen, { type Submitted } from "@/components/checking-screen";

// Opened by public/sw.js right after Android "Share -> FwdCheck"; the shared item waits in Cache Storage.
export default function ShareChecking() {
  const router = useRouter();
  const started = useRef(false); // React dev mode runs effects twice; check only once
  const [err, setErr] = useState("");
  const [submitted, setSubmitted] = useState<Submitted>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const cache = await caches.open("share");
        const saved = await cache.match("/share-data");
        if (!saved) throw new Error("Nothing was shared. Paste the message on the home page instead.");
        await cache.delete("/share-data");
        const fd = fromShare(await saved.formData());
        setSubmitted({ text: (fd.get("text") as string | null) ?? undefined, file: fd.get("file") as File | null });
        router.replace(`/r/${await postCheck(fd)}`);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [router]);

  if (!err) return <main className="min-h-[80dvh]"><CheckingScreen submitted={submitted} kicker="Shared to FwdCheck" /></main>;
  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-4 sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Shared to FwdCheck</p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] sm:text-6xl">Couldn&apos;t check this one.</h1>
      <p role="alert" className="mt-6 text-lg text-muted">{err}</p>
      <Link href="/#check" className="mt-8 self-start rounded-full bg-ink px-6 py-3 text-paper hover:bg-signal">Try on the home page →</Link>
    </main>
  );
}
