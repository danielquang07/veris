import { Connection, PublicKey, type ParsedAccountData } from "@solana/web3.js";
import { getBlacklistSources, readBlacklist, scoreAddress } from "@/lib/blacklist";

/**
 * Veris Shield - on-chain risk report for an SPL token, read straight from Solana.
 *
 * Every check is a fact anyone can verify on chain (no guessing):
 *  - mint authority still set   -> the creator can print unlimited new tokens (dump on buyers)
 *  - freeze authority still set -> the creator can freeze the tokens in your wallet (cannot sell)
 *  - no on-chain metadata       -> anonymous token, nobody stands behind it
 *  - famous ticker on a non-official mint -> impersonation ("USDC" that is not USDC)
 *  - very young token           -> typical of pump-and-dump launches
 *  - reported in the SCAMREG blacklist
 */

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
// LP tokens of Raydium CPMM pools are minted by this program-owned PDA, not by a person
const RAYDIUM_CPMM_LP_AUTHORITY = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_and_lp_mint_auth_seed")],
  new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb")
)[0].toBase58();

// Tickers scammers copy most. A token using one of them must be the official mainnet mint.
const OFFICIAL_MINTS: Record<string, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  SOL: "So11111111111111111111111111111111111111112",
  WSOL: "So11111111111111111111111111111111111111112",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

const NEW_TOKEN_DAYS = 7;
const CACHE_MS = 60_000;

export type CheckStatus = "pass" | "warn" | "fail" | "unknown";
export type TokenCheck = {
  id: "mint_authority" | "freeze_authority" | "metadata" | "impersonation" | "age" | "blacklist";
  label: string; // Vietnamese
  status: CheckStatus;
  detail: string; // Vietnamese
};
export type RiskLevel = "safe" | "caution" | "danger";
export type TokenRiskReport = {
  mint: string;
  name: string | null;
  symbol: string | null;
  tokenProgram: "spl-token" | "token-2022";
  decimals: number;
  level: RiskLevel;
  riskScore: number; // 0-100
  summary: string; // Vietnamese one-liner
  checks: TokenCheck[];
  checkedAt: string;
};

// Weight added to the risk score when a check fails (warn counts half)
const WEIGHT: Record<TokenCheck["id"], number> = {
  mint_authority: 35,
  freeze_authority: 35,
  impersonation: 40,
  blacklist: 50,
  metadata: 15,
  age: 15,
};

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

/** kind = "wallet" when the address is a normal wallet, so the UI can offer a wallet scan instead */
export class NotATokenError extends Error {
  constructor(message: string, readonly kind: "wallet" | "missing" | "other") {
    super(message);
  }
}

const cache = new Map<string, { at: number; report: TokenRiskReport }>();

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function readBorshString(data: Buffer, offset: number): [string, number] {
  const len = data.readUInt32LE(offset);
  const value = data
    .subarray(offset + 4, offset + 4 + len)
    .toString("utf8")
    .replace(/\0/g, "")
    .trim();
  return [value, offset + 4 + len];
}

/** Metaplex token metadata: name + symbol, or null when the token has none */
async function readMetadata(connection: Connection, mint: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM
  );
  const acc = await connection.getAccountInfo(pda);
  if (!acc) return null;
  // Layout: key(1) + update_authority(32) + mint(32) + name(string) + symbol(string) + ...
  const [name, afterName] = readBorshString(acc.data, 1 + 32 + 32);
  const [symbol] = readBorshString(acc.data, afterName);
  return { name: name || null, symbol: symbol || null };
}

/** Age in days when the whole history fits in one page; null for busy, long-lived tokens */
async function readAgeDays(connection: Connection, mint: PublicKey) {
  const sigs = await connection.getSignaturesForAddress(mint, { limit: 1000 });
  if (sigs.length === 0 || sigs.length >= 1000) return { ageDays: null, busy: sigs.length >= 1000 };
  const oldest = sigs[sigs.length - 1].blockTime;
  if (!oldest) return { ageDays: null, busy: false };
  return { ageDays: Math.floor((Date.now() / 1000 - oldest) / 86_400), busy: false };
}

export async function checkToken(connection: Connection, mintAddress: string): Promise<TokenRiskReport> {
  const hit = cache.get(mintAddress);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.report;

  const mint = new PublicKey(mintAddress);
  const info = await connection.getParsedAccountInfo(mint);
  const value = info.value;
  const owner = value?.owner.toBase58();
  const parsed = (value?.data as ParsedAccountData | undefined)?.parsed;
  if (!value || (owner !== TOKEN_PROGRAM && owner !== TOKEN_2022_PROGRAM) || parsed?.type !== "mint") {
    if (!value) throw new NotATokenError("Địa chỉ này chưa có trên Solana Devnet.", "missing");
    if (owner === SYSTEM_PROGRAM)
      throw new NotATokenError("Đây là địa chỉ ví, không phải token.", "wallet");
    throw new NotATokenError("Địa chỉ này không phải một token trên Solana Devnet.", "other");
  }
  const mintInfo = parsed.info as { mintAuthority: string | null; freezeAuthority: string | null; decimals: number };

  // Independent reads in parallel; a failed read becomes an "unknown" check instead of an error
  const [metaRes, ageRes, blacklistRes] = await Promise.allSettled([
    readMetadata(connection, mint),
    readAgeDays(connection, mint),
    readBlacklist(connection, getBlacklistSources([])),
  ]);

  const checks: TokenCheck[] = [];
  const isRaydiumLp = mintInfo.mintAuthority === RAYDIUM_CPMM_LP_AUTHORITY;

  checks.push(
    isRaydiumLp
      ? {
          id: "mint_authority",
          label: "Quyền in thêm token",
          status: "pass",
          detail: "LP token của pool Raydium: chỉ chương trình pool in ra khi có người nạp thanh khoản.",
        }
      : mintInfo.mintAuthority
      ? {
          id: "mint_authority",
          label: "Quyền in thêm token",
          status: "fail",
          detail: `Người tạo (ví ${short(mintInfo.mintAuthority)}) còn in thêm được không giới hạn: token bạn mua có thể mất giá bất cứ lúc nào.`,
        }
      : { id: "mint_authority", label: "Quyền in thêm token", status: "pass", detail: "Đã thu hồi: không ai in thêm được." }
  );

  checks.push(
    mintInfo.freezeAuthority
      ? {
          id: "freeze_authority",
          label: "Quyền đóng băng ví",
          status: "fail",
          detail: `Người tạo (ví ${short(mintInfo.freezeAuthority)}) có thể khóa token trong ví bạn: mua vào rồi có thể không bán ra được.`,
        }
      : { id: "freeze_authority", label: "Quyền đóng băng ví", status: "pass", detail: "Đã thu hồi: không ai khóa được token của bạn." }
  );

  let name: string | null = null;
  let symbol: string | null = null;
  if (isRaydiumLp) {
    name = "Raydium LP";
    symbol = "LP";
    checks.push({ id: "metadata", label: "Thông tin công khai", status: "pass", detail: "Biên nhận thanh khoản (LP) của pool Raydium CPMM." });
  } else if (metaRes.status === "fulfilled") {
    name = metaRes.value?.name ?? null;
    symbol = metaRes.value?.symbol ?? null;
    checks.push(
      metaRes.value
        ? { id: "metadata", label: "Thông tin công khai", status: "pass", detail: `Có tên trên chain: ${name ?? "—"} (${symbol ?? "—"}).` }
        : { id: "metadata", label: "Thông tin công khai", status: "warn", detail: "Token không có tên hay thông tin công khai: không rõ ai đứng sau." }
    );
  } else {
    checks.push({ id: "metadata", label: "Thông tin công khai", status: "unknown", detail: "Chưa đọc được (mạng chậm)." });
  }

  const ticker = (symbol ?? "").toUpperCase();
  const official = OFFICIAL_MINTS[ticker];
  if (!symbol) {
    checks.push({ id: "impersonation", label: "Mạo danh token nổi tiếng", status: "unknown", detail: "Không có tên để đối chiếu." });
  } else if (official && official !== mintAddress) {
    checks.push({
      id: "impersonation",
      label: "Mạo danh token nổi tiếng",
      status: "fail",
      detail: `Đặt tên "${symbol}" nhưng không phải ${ticker} chính chủ (${short(official)}). Đây là token giả.`,
    });
  } else {
    checks.push({ id: "impersonation", label: "Mạo danh token nổi tiếng", status: "pass", detail: "Không trùng tên token nổi tiếng." });
  }

  if (ageRes.status === "fulfilled") {
    const { ageDays, busy } = ageRes.value;
    checks.push(
      ageDays !== null && ageDays < NEW_TOKEN_DAYS
        ? { id: "age", label: "Tuổi token", status: "warn", detail: `Mới tạo ${ageDays} ngày: kiểu "thổi giá rồi xả" hay dùng token mới.` }
        : {
            id: "age",
            label: "Tuổi token",
            status: "pass",
            detail: busy ? "Đã có hơn 1.000 giao dịch." : ageDays !== null ? `Tạo cách đây ${ageDays} ngày.` : "Chưa có giao dịch nào.",
          }
    );
  } else {
    checks.push({ id: "age", label: "Tuổi token", status: "unknown", detail: "Chưa đọc được (mạng chậm)." });
  }

  if (blacklistRes.status === "fulfilled") {
    const reports = scoreAddress(blacklistRes.value, "sol", mintAddress).reportCount;
    checks.push(
      reports > 0
        ? { id: "blacklist", label: "Sổ đen cộng đồng", status: "fail", detail: `Bị báo cáo lừa đảo ${reports} lần trên Solana (SCAMREG).` }
        : { id: "blacklist", label: "Sổ đen cộng đồng", status: "pass", detail: "Chưa ai báo cáo token này." }
    );
  } else {
    checks.push({ id: "blacklist", label: "Sổ đen cộng đồng", status: "unknown", detail: "Chưa tra được sổ đen (mạng chậm)." });
  }

  const riskScore = Math.round(Math.min(
    100,
    checks.reduce((sum, c) => sum + (c.status === "fail" ? WEIGHT[c.id] : c.status === "warn" ? WEIGHT[c.id] / 2 : 0), 0)
  ));
  const hardFail = checks.some((c) => c.status === "fail");
  const level: RiskLevel = riskScore >= 50 ? "danger" : hardFail || riskScore >= 15 ? "caution" : "safe";

  const failed = checks.filter((c) => c.status === "fail").map((c) => c.label.toLowerCase());
  const summary =
    level === "danger"
      ? `Nguy hiểm: ${failed.join(", ")}. Không nên mua.`
      : level === "caution"
        ? "Cần cẩn thận: có dấu hiệu rủi ro, chỉ mua số nhỏ."
        : "Chưa thấy dấu hiệu rủi ro lớn.";

  const report: TokenRiskReport = {
    mint: mintAddress,
    name,
    symbol,
    tokenProgram: owner === TOKEN_2022_PROGRAM ? "token-2022" : "spl-token",
    decimals: mintInfo.decimals,
    level,
    riskScore,
    summary,
    checks,
    checkedAt: new Date().toISOString(),
  };
  cache.set(mintAddress, { at: Date.now(), report });
  return report;
}
