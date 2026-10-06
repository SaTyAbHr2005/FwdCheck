"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";

export default function CheckForm({ initialError }: { initialError?: string }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError ?? "");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const fd = new FormData();
    if (text.trim()) fd.append("text", text.trim());
    if (file) fd.append("file", file);
    try {
      const r = await fetch(`${API}/check`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || "Something went wrong. Please try again.");
      router.push(`/r/${j.id}`);
    } catch (e) {
      setErr(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Can't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="msg" className="block font-medium">Paste the forwarded message or a link</label>
        <textarea id="msg" value={text} onChange={e => setText(e.target.value)} rows={6}
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="e.g. 🚨 URGENT: RBI has banned ₹2000 notes…" />
      </div>
      <div>
        <label htmlFor="file" className="block font-medium">…or upload a screenshot, voice note or PDF</label>
        <input id="file" type="file" accept="image/*,audio/*,application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:font-medium" />
      </div>
      <button disabled={busy || (!text.trim() && !file)}
        className="w-full rounded-xl bg-blue-700 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:opacity-40">
        {busy ? "Checking sources… (about 15 seconds)" : "Check this forward"}
      </button>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{err}</p>}
    </form>
  );
}
