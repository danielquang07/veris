import { NextResponse } from "next/server";
import { isValidAddress } from "@/lib/address";
import { createServerConnection } from "@/lib/blacklist";
import { scanWallet } from "@/lib/walletScan";

/**
 * Veris Shield - wallet health scan.
 * GET /api/wallet-scan?owner=<wallet address> -> WalletScanResult (see lib/walletScan.ts)
 */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner")?.trim() ?? "";
  if (!isValidAddress("sol", owner)) {
    return NextResponse.json({ error: "Địa chỉ ví không hợp lệ." }, { status: 400 });
  }
  try {
    return NextResponse.json(await scanWallet(createServerConnection(), owner));
  } catch (e) {
    console.error("[api/wallet-scan]", e);
    return NextResponse.json({ error: "Chưa đọc được ví lúc này, thử lại sau." }, { status: 502 });
  }
}
