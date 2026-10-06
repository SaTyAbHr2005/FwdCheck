import { API } from "@/lib/api";

// Relative redirect: works on any domain (Vercel, tunnels, localhost).
const redirect = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

// Android "Share -> FwdCheck" lands here (see public/manifest.json share_target).
export async function POST(req: Request) {
  const inFd = await req.formData();
  const fd = new FormData();
  const text = [inFd.get("text"), inFd.get("url")].filter(v => typeof v === "string" && v).join(" ").trim();
  if (text) fd.append("text", text);
  const file = inFd.get("file");
  if (file instanceof File && file.size > 0) fd.append("file", file);
  try {
    const r = await fetch(`${API}/check`, { method: "POST", body: fd });
    if (r.ok) return redirect(`/r/${(await r.json()).id}`);
  } catch {}
  return redirect("/?error=share");
}
