import { ImageResponse } from "next/og";
import { getResult, STYLE } from "@/lib/api";

// Public host for the "Full proof" line. Behind proxies/tunnels req.url says localhost, so prefer configured values.
function siteHost(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) return configured.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return req.headers.get("x-forwarded-host") ?? new URL(req.url).host;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getResult(id);
  if (!r) return new Response("Not found", { status: 404 });
  const s = STYLE[r.overall] ?? STYLE.UNVERIFIABLE;
  const lines = r.claims.filter(c => c.verdict !== "UNVERIFIABLE").slice(0, 4);
  const sources = [...new Set(r.claims.flatMap(c => c.evidence.map(e => e.source)))].slice(0, 3);
  const link = siteHost(req) + `/r/${id.slice(0, 8)}…`;
  const mark: Record<string, string> = { VERIFIED: "TRUE", FALSE: "FALSE", OUTDATED: "OUTDATED", PARTLY_TRUE: "PARTLY TRUE" };

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, display: "flex", flexDirection: "column", background: "white", fontSize: 38, color: "#111827" }}>
        <div style={{ display: "flex", background: s.color, color: "white", padding: "56px 56px", fontSize: 92, fontWeight: 800 }}>
          {s.label.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 56px", gap: 30, flexGrow: 1 }}>
          {lines.length === 0 && <div style={{ display: "flex" }}>No checkable facts found.</div>}
          {lines.map(c => (
            <div key={c.claim_id} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: STYLE[c.verdict]?.color ?? "#6b7280" }}>
                {mark[c.verdict] ?? c.verdict}
              </div>
              <div style={{ display: "flex" }}>{c.claim.length > 90 ? c.claim.slice(0, 88) + "…" : c.claim}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "32px 56px", fontSize: 30, color: "#374151", borderTop: "2px solid #e5e7eb" }}>
          {sources.length > 0 && <div style={{ display: "flex" }}>Sources: {sources.join(" · ")}</div>}
          <div style={{ display: "flex" }}>Full proof: {link}</div>
          <div style={{ display: "flex", fontWeight: 800, marginTop: 8 }}>Checked by FwdCheck</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
