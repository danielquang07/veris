import { NextResponse } from "next/server";
import { readBlacklist, getBlacklistSources, scoreAddress, createServerConnection } from "@/lib/blacklist";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (process.env.NEXT_PUBLIC_AI_ENABLED !== "true") {
    return NextResponse.json({ error: "AI disabled" }, { status: 503 });
  }

  const subject_pubkey = typeof body?.subject_pubkey === "string" ? body.subject_pubkey.trim() : "";
  let blacklistBonus = 0;
  const blacklistSignals: string[] = [];
  let scamregReportCount = 0;

  if (subject_pubkey) {
    try {
      const conn = createServerConnection();
      const records = await readBlacklist(conn, getBlacklistSources([]));
      const score = scoreAddress(records, "sol", subject_pubkey);
      if (score.reportCount >= 1) {
        scamregReportCount = score.reportCount;
        // ≥1 report → bonus ≥ 40. Nếu nhiều report → lên đến 70+
        blacklistBonus = Math.min(100, 30 + 10 * score.reportCount);
        blacklistSignals.push(`Ví bị báo cáo ${score.reportCount} lần trên Solana (SCAMREG)`);
      }
    } catch (e) {
      console.warn("[api/analyze] Blacklist lookup error:", e);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    if (blacklistBonus > 0) {
      const baseScore = typeof data.risk_score === "number" ? data.risk_score : 0;
      const combinedScore = Math.min(100, baseScore + blacklistBonus);
      data.risk_score = combinedScore;
      data.signals = [...(Array.isArray(data.signals) ? data.signals : []), ...blacklistSignals];
      if (combinedScore >= 70) {
        data.label = "SCAM";
      } else if (combinedScore >= 40 && data.label !== "SCAM") {
        data.label = "SUSPICIOUS";
      }
      if (!data.on_chain_context) {
        data.on_chain_context = { report_count: 0, recent_tx_count: 0, wallet_age_days: null };
      }
      data.on_chain_context.report_count = Math.max(data.on_chain_context.report_count || 0, scamregReportCount);
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AI service unreachable: ${msg}` }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
