import { NextResponse } from "next/server";
import {
  CHAIN_NAME,
  extractAddresses,
  isValidAddress,
  sameAddress,
  shortenAddress,
  type Chain,
} from "@/lib/address";
import {
  createServerConnection,
  getBlacklistSources,
  readBlacklist,
  readWalletHistory,
  scoreAddress,
  type BlacklistRecord,
} from "@/lib/blacklist";
import { depositRate } from "@/lib/tempWallet";

/**
 * Mode 2 - Player-to-player trade. Called at step 1 (deal agreed), before the temp wallet opens.
 *
 * Pure code: deposit rate, blacklist + first funder of both parties, stranger wallet
 * addresses posted in chat. It only advises - it never moves money.
 *
 * Request:  { chain, value, buyer, seller, chat?, tempWalletAddress?, blacklistSources? }
 * Response: TradeCheckResult
 */

type Recommendation = "continue" | "warn";

export type PartyCheck = {
  address: string;
  reportCount: number;
  reporterCount: number;
  firstFunder: string | null;
  funderBlacklisted: boolean;
  txCount: number | null;
  firstSeen: string | null;
  isNewWallet: boolean;
  note: string | null; // Vietnamese
};

export type TradeCheckResult = {
  depositRate: number;
  deposit: number;
  level: "green" | "yellow";
  recommendation: Recommendation;
  reasons: string[]; // Vietnamese
  buyer: PartyCheck;
  seller: PartyCheck;
  strangerAddressesInChat: string[];
};

async function checkParty(chain: Chain, address: string, records: BlacklistRecord[]): Promise<PartyCheck> {
  const score = scoreAddress(records, chain, address);
  const result: PartyCheck = {
    address,
    reportCount: score.reportCount,
    reporterCount: score.reporterCount,
    firstFunder: null,
    funderBlacklisted: false,
    txCount: null,
    firstSeen: null,
    isNewWallet: false,
    note: null,
  };

  if (chain !== "sol") {
    result.note = "Chưa hỗ trợ đọc lịch sử ví Sui — chỉ đối chiếu sổ đen.";
    return result;
  }

  try {
    const history = await readWalletHistory(createServerConnection(), address);
    result.txCount = history.txCount;
    result.firstSeen = history.firstSeen;
    result.firstFunder = history.firstFunder;
    result.funderBlacklisted = Boolean(
      history.firstFunder && scoreAddress(records, "sol", history.firstFunder).reportCount > 0
    );
    const oneDay = 24 * 60 * 60 * 1000;
    result.isNewWallet =
      history.fullyCounted &&
      (history.txCount < 3 ||
        (history.firstSeen !== null && Date.now() - Date.parse(history.firstSeen) < oneDay));
  } catch (e) {
    console.error("Wallet history read failed:", e);
    result.note = "Chưa đọc được lịch sử ví lúc này (mạng chậm).";
  }
  return result;
}

const SEVERITY: Record<Recommendation, number> = { continue: 0, warn: 1 };
const escalate = (a: Recommendation, b: Recommendation): Recommendation =>
  SEVERITY[b] > SEVERITY[a] ? b : a;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chain = body?.chain as Chain;
    const value = Number(body?.value);
    const buyer = String(body?.buyer ?? "").trim();
    const seller = String(body?.seller ?? "").trim();
    const chat = typeof body?.chat === "string" ? body.chat.slice(0, 6000) : "";
    const tempWalletAddress = typeof body?.tempWalletAddress === "string" ? body.tempWalletAddress : "";

    if (chain !== "sol" && chain !== "sui")
      return NextResponse.json({ error: "chain phải là \"sol\" hoặc \"sui\"" }, { status: 400 });
    if (!(value > 0)) return NextResponse.json({ error: "value phải lớn hơn 0" }, { status: 400 });
    for (const [label, address] of [["người mua", buyer], ["người bán", seller]] as const) {
      if (!isValidAddress(chain, address))
        return NextResponse.json(
          { error: `Ví ${label} không phải địa chỉ ${CHAIN_NAME[chain]} hợp lệ` },
          { status: 400 }
        );
    }
    if (sameAddress(chain, buyer, seller))
      return NextResponse.json({ error: "Người mua và người bán không được trùng ví" }, { status: 400 });

    const rate = depositRate(chain, value);
    const deposit = Math.round(value * rate * 1e9) / 1e9;
    const ratePct = Math.round(rate * 100);

    // --- Code: blacklist + wallet history of both parties ---
    let records: BlacklistRecord[] = [];
    const reasons: string[] = [];
    try {
      records = await readBlacklist(createServerConnection(), getBlacklistSources(body?.blacklistSources));
    } catch (e) {
      console.error("Blacklist read failed:", e);
      reasons.push("Chưa tra được sổ đen lúc này (mạng chậm).");
    }
    const [buyerCheck, sellerCheck] = await Promise.all([
      checkParty(chain, buyer, records),
      checkParty(chain, seller, records),
    ]);

    let recommendation: Recommendation = "continue";
    for (const [label, party] of [["Người mua", buyerCheck], ["Người bán", sellerCheck]] as const) {
      if (party.reportCount > 0) {
        recommendation = escalate(recommendation, "warn");
        reasons.push(`${label} đã bị báo cáo lừa đảo ${party.reportCount} lần (từ ${party.reporterCount} ví).`);
      }
      if (party.funderBlacklisted && party.firstFunder) {
        recommendation = escalate(recommendation, "warn");
        reasons.push(
          `${label} được nạp tiền lần đầu từ ví ${shortenAddress(party.firstFunder)} — ví này nằm trong sổ đen.`
        );
      }
      if (party.isNewWallet) {
        reasons.push(`${label} dùng ví mới tạo. Không sao: tiền cọc ${ratePct}% đã bảo vệ bạn nếu họ bùng.`);
      }
    }

    // --- Code: stranger wallet addresses posted in chat ---
    const strangerAddressesInChat = extractAddresses(chat)
      .filter((a) => a.chain === chain)
      .map((a) => a.address)
      .filter(
        (a) =>
          !sameAddress(chain, a, buyer) &&
          !sameAddress(chain, a, seller) &&
          !(tempWalletAddress && sameAddress(chain, a, tempWalletAddress))
      );
    if (strangerAddressesInChat.length > 0) {
      recommendation = escalate(recommendation, "warn");
      reasons.push(
        `Trong chat có địa chỉ ví lạ (${strangerAddressesInChat.map(shortenAddress).join(", ")}). Chỉ cọc vào temp wallet hiện trong game, không chuyển theo địa chỉ gửi qua chat.`
      );
    }

    const result: TradeCheckResult = {
      depositRate: rate,
      deposit,
      level: recommendation === "continue" ? "green" : "yellow",
      recommendation,
      reasons,
      buyer: buyerCheck,
      seller: sellerCheck,
      strangerAddressesInChat,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Không kiểm tra được kèo, thử lại sau." }, { status: 500 });
  }
}
