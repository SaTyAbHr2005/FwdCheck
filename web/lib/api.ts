export type VerdictKind = "VERIFIED" | "FALSE" | "OUTDATED" | "PARTLY_TRUE" | "UNVERIFIABLE";
export type Evidence = { quote: string; url: string; source: string; tier: string; date?: string | null };
export type Verdict = {
  claim_id: string; claim: string; verdict: VerdictKind; confidence: number;
  what_is_wrong: string; explanation: string; timeline: { date: string; event: string }[]; evidence: Evidence[];
};
export type Result = {
  id: string; language: string; input_type: string; text: string; overall: string;
  summary: string; claims: Verdict[]; red_flags: { type: string; text: string }[]; cached: boolean;
};
export type TrendingRow = { id: string; raw_text: string; overall: string; hit_count: number; created_at: string };

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Hex (not CSS vars) because the OG card renderer needs literal colours.
export const STYLE: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: "Verified", color: "#1e7a4c" },
  TRUE: { label: "True", color: "#1e7a4c" },
  FALSE: { label: "False", color: "#e0401b" },
  MISLEADING: { label: "Misleading", color: "#e0401b" },
  OUTDATED: { label: "Outdated", color: "#b97a06" },
  PARTLY_TRUE: { label: "Partly true", color: "#b97a06" },
  UNVERIFIABLE: { label: "Cannot be confirmed", color: "#77736a" },
  NO_CLAIMS: { label: "Nothing to check", color: "#77736a" },
};

export const TIER: Record<string, string> = {
  official: "Official", factchecker: "Fact-checker", news: "News", other: "Web",
};

export const FLAG: Record<string, string> = {
  urgency: "Urgency", fear: "Fear / threat", chain_forward: "Chain-forward", authority: "Fake authority",
  miracle: "Miracle claim", suspicious_link: "Suspicious link", other: "Other trick",
};

// A share that carries only a file's name ("circular.pdf"): Android dropped the file itself.
const JUST_A_FILENAME = /^[^\s/\\]+\.[a-z0-9]{2,5}$/i;

/** Android share-target fields (text, url, file) -> the /check form. Throws if the shared file didn't arrive. */
export function fromShare(inFd: FormData): FormData {
  const fd = new FormData();
  const text = [inFd.get("text"), inFd.get("url")].filter(v => typeof v === "string" && v).join(" ").trim();
  const file = inFd.get("file");
  const hasFile = typeof file !== "string" && !!file && file.size > 0;   // not instanceof: server runtimes differ
  if (!hasFile && (!text || JUST_A_FILENAME.test(text)))
    throw new Error("The file didn't come through from your phone's Share menu. Open FwdCheck and tap “+ Screenshot · voice · PDF” to upload it instead.");
  if (text && !(hasFile && JUST_A_FILENAME.test(text))) fd.append("text", text);
  if (hasFile) fd.append("file", file);
  return fd;
}

/** Run a check; returns the result id. Errors carry a message fit to show the user. */
export async function postCheck(fd: FormData): Promise<string> {
  let r: Response;
  try {
    r = await fetch(`${API}/check`, { method: "POST", body: fd });
  } catch {
    throw new Error("Can't reach the server. It may be waking up, try again in 30 seconds.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || "Something went wrong. Please try again.");
  return j.id;
}

export async function getResult(id: string): Promise<Result | null> {
  try {
    const r = await fetch(`${API}/check/${id}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
