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

  const ink = "#141311", paper = "#f1ece1", muted = "#6d685e";

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, display: "flex", flexDirection: "column", background: paper, color: ink, fontSize: 36, padding: 64 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, letterSpacing: 4, color: muted }}>
          <span>FWDCHECK · FORWARD VERIFICATION</span>
          <span>№ {id.slice(0, 8)}</span>
        </div>
        <div style={{ display: "flex", marginTop: 56 }}>
          <div style={{ display: "flex", border: `8px solid ${s.color}`, borderRadius: 14, color: s.color, padding: "10px 36px",
            fontSize: 96, fontWeight: 800, letterSpacing: 6, transform: "rotate(-4deg)" }}>
            {s.label.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 64, flexGrow: 1 }}>
          {lines.length === 0 && <div style={{ display: "flex" }}>No checkable facts found.</div>}
          {lines.map(c => (
            <div key={c.claim_id} style={{ display: "flex", gap: 24, borderTop: "2px solid #d6cfbf", paddingTop: 20 }}>
              <div style={{ display: "flex", width: 210, flexShrink: 0, fontSize: 24, fontWeight: 800, letterSpacing: 2, color: STYLE[c.verdict]?.color ?? muted }}>
                {mark[c.verdict] ?? c.verdict}
              </div>
              <div style={{ display: "flex" }}>{c.claim.length > 90 ? c.claim.slice(0, 88) + "…" : c.claim}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 26, color: muted }}>
          {sources.length > 0 && <div style={{ display: "flex" }}>Sources: {sources.join(" · ")}</div>}
          <div style={{ display: "flex" }}>Full proof: {link}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 30, fontWeight: 800, color: ink }}>Check before you forward.</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
