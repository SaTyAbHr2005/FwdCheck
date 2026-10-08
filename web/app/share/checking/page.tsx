"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fromShare, postCheck } from "@/lib/api";
import CheckingScreen, { type Submitted } from "@/components/checking-screen";

// What the phone's Share menu actually delivered, shown when a share fails (field: value / file name, type, size).
function describe(fd: FormData): string {
  const parts = [...fd.entries()].map(([k, v]) =>
    typeof v === "string" ? `${k}: “${v.slice(0, 40)}”` : `${k}: ${v.name || "unnamed"} (${v.type || "no type"}, ${v.size} bytes)`);
  return parts.join(" · ") || "nothing";
}

// Opened by public/sw.js right after Android "Share -> FwdCheck"; the shared item waits in Cache Storage.
export default function ShareChecking() {
  const router = useRouter();
  const started = useRef(false); // React dev mode runs effects twice; check only once
  const [err, setErr] = useState("");
  const [submitted, setSubmitted] = useState<Submitted>();
  const [received, setReceived] = useState("");
  // Some phones (WhatsApp on Xiaomi, non-Chrome browsers) share only a caption like "Photo from Rohit", not the photo.
  const [missing, setMissing] = useState<string | null>(null);

  async function run(fd: FormData) {
    setErr("");
    setSubmitted({ text: (fd.get("text") as string | null) ?? undefined, file: fd.get("file") as File | null });
    try {
      router.replace(`/r/${await postCheck(fd)}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const cache = await caches.open("share");
      const saved = await cache.match("/share-data");
      if (!saved) return setErr("Nothing was shared. Paste the message on the home page instead.");
      await cache.delete("/share-data");
      const raw = await saved.formData();
      const atShare = saved.headers.get("x-share-received");
      setReceived(describe(raw) + (atShare ? ` (at share time: ${decodeURIComponent(atShare)})` : ""));
      let fd: FormData;
      try {
        fd = fromShare(raw);
      } catch {
        const title = raw.get("title");
        return setMissing(typeof title === "string" && title.trim() ? title.trim() : "");
      }
      await run(fd);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per share
  }, []);

  function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMissing(null);
    const fd = new FormData();
    fd.append("file", file);
    run(fd);
  }

  if (missing !== null) return (
    <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center px-4 sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Shared to FwdCheck</p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] sm:text-6xl">One more tap<span className="text-signal">.</span></h1>
      <p className="mt-6 text-lg leading-snug text-muted">
        {missing ? <>WhatsApp sent “{missing}”, but your phone didn&apos;t pass the file itself. </> : <>Your phone didn&apos;t pass the file itself. </>}
        Pick it below: it&apos;s under <span className="text-ink">Recent</span> or the <span className="text-ink">WhatsApp Images</span> album.
      </p>
      <label className="mt-8 inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full bg-ink px-7 py-4 text-lg text-paper transition-colors hover:bg-signal">
        Choose the file →
        <input type="file" accept="image/*,audio/*,application/pdf,.opus,.ogg,.m4a,.heic,.heif,text/plain,.txt" className="sr-only" onChange={picked} />
      </label>
      <Link href="/#check" className="mt-5 self-start font-mono text-xs uppercase tracking-[0.14em] text-muted underline decoration-signal underline-offset-4 hover:text-signal">
        Or paste the message on the home page →
      </Link>
      <details className="mt-10 border-t border-line pt-4 font-mono text-[11px] text-muted">
        <summary className="cursor-pointer">Details</summary>
        <p className="mt-2 break-all leading-relaxed">Received from your phone: {received}</p>
      </details>
    </main>
  );

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
