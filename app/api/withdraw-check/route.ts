import { NextResponse } from "next/server";
import {
  CHAIN_NAME,
  guessChain,
  isLookalikeAddress,
  isValidAddress,
  sameAddress,
  shortenAddress,
  type Chain,
} from "@/lib/address";
import {
  createServerConnection,
  getBlacklistSources,
  readBlacklist,
  scoreAddress,
} from "@/lib/blacklist";

/**
 * Mode 1 - Withdraw to your own wallet.
 * Pure code, no AI: a player withdrawing to their own wallet is never asked anything.
 *
 * Check 1: does the address match the chain? (Sui address for SUI, Solana for SOL)
 * Check 2: is it a wallet linked to the game account?
 * Not a linked wallet -> warning with reasons (lookalike address, blacklist hits).
 *
 * Request:  { chain: "sol" | "sui", to: string, linkedWallets: string[], blacklistSources?: string[] }
 * Response: WithdrawCheckResult
 */

export type WithdrawCheckResult = {
  level: "green" | "red";
  action: "withdraw" | "warn" | "block";
  title: string; // Vietnamese, shown to the player
  reasons: string[]; // Vietnamese, shown to the player
  reportCount: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chain = body?.chain as Chain;
    const to = String(body?.to ?? "").trim();
    const linkedWallets: string[] = Array.isArray(body?.linkedWallets)
      ? body.linkedWallets.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    if (chain !== "sol" && chain !== "sui") {
      return NextResponse.json({ error: "chain phải là \"sol\" hoặc \"sui\"" }, { status: 400 });
    }
    if (!to) {
      return NextResponse.json({ error: "Thiếu địa chỉ nhận" }, { status: 400 });
    }

    // Check 1: wrong chain = funds lost, so BLOCK instead of just warning
    if (!isValidAddress(chain, to)) {
      const actualChain = guessChain(to);
      return NextResponse.json({
        level: "red",
        action: "block",
        title: "Chặn: địa chỉ không đúng chuỗi",
        reasons: [
          actualChain
            ? `Đây là địa chỉ ${CHAIN_NAME[actualChain]}, nhưng bạn đang rút ${chain.toUpperCase()}. Gửi sang sẽ mất tiền.`
            : `Địa chỉ không hợp lệ trên ${CHAIN_NAME[chain]}. Kiểm tra lại, có thể bị thiếu hoặc thừa ký tự.`,
        ],
        reportCount: 0,
      } satisfies WithdrawCheckResult);
    }

    // Check 2: own wallet -> withdraw right away, no questions
    const sameChainWallets = linkedWallets.filter((w) => isValidAddress(chain, w));
    if (sameChainWallets.some((w) => sameAddress(chain, w, to))) {
      return NextResponse.json({
        level: "green",
        action: "withdraw",
        title: "Ví của bạn — rút ngay",
        reasons: [],
        reportCount: 0,
      } satisfies WithdrawCheckResult);
    }

    // Not a linked wallet: collect reasons for the warning
    const reasons: string[] = [];
    const imitated = sameChainWallets.find((w) => isLookalikeAddress(chain, to, w));
    if (imitated) {
      reasons.push(
        `Địa chỉ này gần giống ví của bạn (${shortenAddress(imitated)}) nhưng KHÔNG phải. Rất có thể bạn đã bị tráo địa chỉ khi copy.`
      );
    }
    reasons.push(
      "Đây không phải ví đã liên kết với tài khoản game của bạn. Nếu có người nhờ bạn \"rút hộ\" vào ví này, hãy dừng lại."
    );

    let reportCount = 0;
    try {
      const records = await readBlacklist(createServerConnection(), getBlacklistSources(body?.blacklistSources));
      const score = scoreAddress(records, chain, to);
      reportCount = score.reportCount;
      if (reportCount > 0) {
        reasons.unshift(
          `Địa chỉ đã bị báo cáo lừa đảo ${reportCount} lần, từ ${score.reporterCount} ví khác nhau (ghi trên Solana).`
        );
      }
    } catch (e) {
      // Blacklist unreachable: still answer (fail-open), just say so
      console.error("Blacklist read failed:", e);
      reasons.push("Chưa tra được sổ đen lúc này (mạng chậm).");
    }

    return NextResponse.json({
      level: "red",
      action: "warn",
      title: imitated
        ? "Cảnh báo: địa chỉ nhái ví của bạn"
        : reportCount > 0
          ? "Cảnh báo: địa chỉ trong sổ đen"
          : "Cảnh báo: đây KHÔNG phải ví của bạn",
      reasons,
      reportCount,
    } satisfies WithdrawCheckResult);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Không kiểm tra được, thử lại sau." }, { status: 500 });
  }
}
