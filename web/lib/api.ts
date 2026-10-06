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

export const STYLE: Record<string, { label: string; cls: string; emoji: string; color: string }> = {
  VERIFIED: { label: "Verified", cls: "bg-green-50 text-green-900 border-green-300", emoji: "🟢", color: "#16a34a" },
  TRUE: { label: "True", cls: "bg-green-50 text-green-900 border-green-300", emoji: "🟢", color: "#16a34a" },
  FALSE: { label: "False", cls: "bg-red-50 text-red-900 border-red-300", emoji: "🔴", color: "#dc2626" },
  MISLEADING: { label: "Misleading", cls: "bg-red-50 text-red-900 border-red-300", emoji: "🔴", color: "#dc2626" },
  OUTDATED: { label: "Outdated", cls: "bg-amber-50 text-amber-900 border-amber-300", emoji: "⏳", color: "#d97706" },
  PARTLY_TRUE: { label: "Partly true", cls: "bg-amber-50 text-amber-900 border-amber-300", emoji: "🟠", color: "#d97706" },
  UNVERIFIABLE: { label: "Cannot be confirmed", cls: "bg-gray-50 text-gray-800 border-gray-300", emoji: "⚪", color: "#6b7280" },
  NO_CLAIMS: { label: "Nothing to check", cls: "bg-gray-50 text-gray-800 border-gray-300", emoji: "⚪", color: "#6b7280" },
};

export const TIER: Record<string, string> = {
  official: "🏛️ Official", factchecker: "✅ Fact-checker", news: "📰 News", other: "🌐 Web",
};

export const FLAG: Record<string, string> = {
  urgency: "Urgency", fear: "Fear / threat", chain_forward: "Chain-forward", authority: "Fake authority",
  miracle: "Miracle claim", suspicious_link: "Suspicious link", other: "Other trick",
};

export async function getResult(id: string): Promise<Result | null> {
  try {
    const r = await fetch(`${API}/check/${id}`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
