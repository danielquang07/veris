import { NextResponse } from "next/server";
import { isValidAddress } from "@/lib/address";
import { createServerConnection } from "@/lib/blacklist";
import { checkToken, NotATokenError } from "@/lib/tokenRisk";

/**
 * Veris Shield - on-chain token risk report.
 *
 * GET  /api/token-check?mint=<address>
 * POST /api/token-check { mint }
 * -> TokenRiskReport (see lib/tokenRisk.ts)
 */
async function handle(mint: string) {
  if (!isValidAddress("sol", mint)) {
    return NextResponse.json({ error: "Địa chỉ token không hợp lệ." }, { status: 400 });
  }
  try {
    return NextResponse.json(await checkToken(createServerConnection(), mint));
  } catch (e) {
    if (e instanceof NotATokenError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[api/token-check]", e);
    return NextResponse.json({ error: "Chưa đọc được dữ liệu token lúc này, thử lại sau." }, { status: 502 });
  }
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams.get("mint")?.trim() ?? "");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return handle(typeof body?.mint === "string" ? body.mint.trim() : "");
}
