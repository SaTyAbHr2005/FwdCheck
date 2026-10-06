"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fromShare, postCheck } from "@/lib/api";
import CheckingSteps from "@/components/checking-steps";

// Opened by public/sw.js right after Android "Share -> FwdCheck"; the shared item waits in Cache Storage.
export default function ShareChecking() {
  const router = useRouter();
  const started = useRef(false); // React dev mode runs effects twice; check only once
  const [err, setErr] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const cache = await caches.open("share");
        const saved = await cache.match("/share-data");
        if (!saved) throw new Error("Nothing was shared. Paste the message on the home page instead.");
        await cache.delete("/share-data");
        router.replace(`/r/${await postCheck(fromShare(await saved.formData()))}`);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-4 sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
        <span className="mr-2 inline-block size-1.5 -translate-y-px animate-pulse rounded-full bg-signal align-middle" />
        Shared to FwdCheck
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] sm:text-6xl">
        {err ? "Couldn't check this one." : <>Checking your forward<span className="text-signal">…</span></>}
      </h1>
      {err ? (
        <>
          <p role="alert" className="mt-6 text-lg text-muted">{err}</p>
          <Link href="/#check" className="mt-8 self-start rounded-full bg-ink px-6 py-3 text-paper hover:bg-signal">Try on the home page →</Link>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg text-muted">Usually about 15 seconds. Keep this screen open.</p>
          <CheckingSteps className="mt-10 rounded-[18px] border border-line bg-paper-2 p-5 text-sm" />
        </>
      )}
    </main>
  );
}
