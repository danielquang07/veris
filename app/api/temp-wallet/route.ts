import { NextResponse } from "next/server";
import { isValidAddress, type Chain } from "@/lib/address";
import { applyEvent, createTrade, type Trade, type TradeEvent } from "@/lib/tempWallet";

/**
 * Temp wallet rules as an API, for the game backend to call.
 * Stateless: the game backend stores `trade`, sends it with each event, and gets back the
 * new `trade` plus `payouts` (if any) to execute the actual transfers itself.
 *
 * POST { create: { id, chain, value, buyer, seller } } -> { trade }
 * POST { trade, event }                                -> { trade }
 *
 * Note: "deliver" must come from the game server itself; "unfreeze" and "admin_resolve"
 * are admin-only - the game backend enforces permissions before calling.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body?.create) {
      const c = body.create as { id: string; chain: Chain; value: number; buyer: string; seller: string };
      if (c.chain !== "sol" && c.chain !== "sui")
        return NextResponse.json({ error: "chain phải là \"sol\" hoặc \"sui\"" }, { status: 400 });
      if (!isValidAddress(c.chain, c.buyer) || !isValidAddress(c.chain, c.seller))
        return NextResponse.json({ error: "Địa chỉ ví không hợp lệ" }, { status: 400 });
      return NextResponse.json({
        trade: createTrade({ ...c, id: String(c.id ?? ""), value: Number(c.value) }),
      });
    }

    const trade = body?.trade as Trade | undefined;
    const event = body?.event as TradeEvent | undefined;
    if (!trade || !event)
      return NextResponse.json({ error: "Cần { create } hoặc { trade, event }" }, { status: 400 });

    return NextResponse.json({ trade: applyEvent(trade, event) });
  } catch (err) {
    // Rule violations (wrong step, payout to a foreign wallet...) come back as 400 with the reason
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
