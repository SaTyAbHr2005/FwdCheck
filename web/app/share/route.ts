import { fromShare, postCheck } from "@/lib/api";

// Relative redirect: works on any domain (Vercel, tunnels, localhost).
const redirect = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

// Fallback for Android "Share -> FwdCheck" when the service worker isn't in control yet.
// Normally public/sw.js catches this POST and opens /share/checking instantly instead.
export async function POST(req: Request) {
  try {
    return redirect(`/r/${await postCheck(fromShare(await req.formData()))}`);
  } catch {
    return redirect("/?error=share");
  }
}
