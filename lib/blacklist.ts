import {
  Connection,
  PublicKey,
  clusterApiUrl,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { scoreOnChain, type Report } from "@/lib/scoring";
import { sameAddress, type Chain } from "@/lib/address";

/** Server-side Solana connection (API routes) - same RPC as the browser side */
export function createServerConnection() {
  return new Connection(process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet"), "confirmed");
}

export type BlacklistRecord = {
  signature: string;
  reporter: string;
  target: string;
  category: string;
  time: string | null;
};

/**
 * Build a blacklist memo. Same SCAMREG v1 format as the records already on chain
 * ("loai" is the original key for the category), so old and new reports read the same way.
 */
export function buildReportMemo(target: string, category: string): string {
  return ["SCAMREG", "v1", `target=${target}`, `loai=${category}`].join("|");
}

/** Split the "key=value" fields of a SCAMREG memo string */
export function parseMemo(memo: string): { target: string; category: string } | null {
  if (!memo.startsWith("SCAMREG|")) return null;
  const parts = memo.split("|");
  const get = (key: string) =>
    parts.find((p) => p.startsWith(`${key}=`))?.slice(key.length + 1) ?? "";
  const target = get("target");
  if (!target) return null;
  return { target, category: get("loai") };
}

/**
 * Read the blacklist from chain: SCAMREG memos signed by trusted "source" wallets
 * (e.g. the game admin wallet, the Veris team wallet). No app-side database.
 */
// The public devnet RPC rejects big getParsedTransactions batches ("Too many requests"),
// so fetch in small chunks and cache the result briefly - every check reads the blacklist.
const TX_CHUNK = 5;
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; records: BlacklistRecord[] }>();

export async function readBlacklist(
  connection: Connection,
  sources: string[],
  limitPerSource = 25
): Promise<BlacklistRecord[]> {
  const cacheKey = [...sources].sort().join(",");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.records;

  const records: BlacklistRecord[] = [];

  for (const source of sources) {
    let key: PublicKey;
    try {
      key = new PublicKey(source);
    } catch {
      continue;
    }
    const sigs = await connection.getSignaturesForAddress(key, { limit: limitPerSource });

    for (let start = 0; start < sigs.length; start += TX_CHUNK) {
      const chunk = sigs.slice(start, start + TX_CHUNK);
      const txs = await connection.getParsedTransactions(
        chunk.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0 }
      );

      txs.forEach((tx, i) => {
        if (!tx) return;
        for (const ix of tx.transaction.message.instructions) {
          // The Memo program returns the memo text directly in "parsed"
          const memo = "parsed" in ix && typeof ix.parsed === "string" ? ix.parsed : null;
          if (!memo) continue;
          const parsed = parseMemo(memo);
          // Reports without an extracted payment target cannot be matched against anything
          if (!parsed || parsed.target === "khong-xac-dinh") continue;
          records.push({
            ...parsed,
            signature: chunk[i].signature,
            reporter: tx.transaction.message.accountKeys[0].pubkey.toBase58(),
            time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
          });
        }
      });
    }
  }

  cache.set(cacheKey, { at: Date.now(), records });
  return records;
}

/** Score one address against the blacklist, reusing the existing scoreOnChain formula */
export function scoreAddress(records: BlacklistRecord[], chain: Chain, address: string) {
  const reports: Report[] = records
    .filter((r) => sameAddress(chain, r.target, address))
    .map((r) => ({
      signature: r.signature,
      reporterWallet: r.reporter,
      reportedWallet: address,
      time: r.time ?? "",
      severity: 3, // memo v1 has no severity yet -> use the midpoint
    }));
  return scoreOnChain(reports, address);
}

export type WalletHistory = {
  txCount: number;
  fullyCounted: boolean; // false = wallet has more transactions than we read
  firstSeen: string | null;
  firstFunder: string | null; // wallet that sent the first SOL into this address
};

function findSender(tx: ParsedTransactionWithMeta, address: string): string | null {
  const all = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((x) => x.instructions),
  ];
  for (const ix of all) {
    if (!("parsed" in ix) || typeof ix.parsed !== "object" || !ix.parsed) continue;
    const p = ix.parsed as { type?: string; info?: Record<string, unknown> };
    if (
      ix.program === "system" &&
      (p.type === "transfer" || p.type === "createAccount") &&
      (p.info?.destination === address || p.info?.newAccount === address)
    ) {
      return String(p.info?.source ?? "");
    }
  }
  return null;
}

/**
 * Read a Solana wallet's history: age, tx count, and who funded it first.
 * A scammer can create a fresh wallet, but it has to be funded from somewhere -
 * if the funder is blacklisted, the fresh wallet belongs to the same ring.
 * Reads at most pages * 1000 signatures so the RPC never hangs.
 */
export async function readWalletHistory(
  connection: Connection,
  address: string,
  pages = 3
): Promise<WalletHistory> {
  const key = new PublicKey(address);
  let before: string | undefined;
  let count = 0;
  let oldest: { signature: string; blockTime?: number | null } | null = null;
  let fullyCounted = false;

  for (let i = 0; i < pages; i++) {
    const page = await connection.getSignaturesForAddress(key, { limit: 1000, before });
    count += page.length;
    if (page.length > 0) {
      oldest = page[page.length - 1];
      before = oldest.signature;
    }
    if (page.length < 1000) {
      fullyCounted = true;
      break;
    }
  }

  if (!oldest) return { txCount: 0, fullyCounted: true, firstSeen: null, firstFunder: null };

  let firstFunder: string | null = null;
  if (fullyCounted) {
    const tx = await connection.getParsedTransaction(oldest.signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (tx) firstFunder = findSender(tx, address);
  }

  return {
    txCount: count,
    fullyCounted,
    firstSeen: fullyCounted && oldest.blockTime ? new Date(oldest.blockTime * 1000).toISOString() : null,
    firstFunder,
  };
}

/** Blacklist source wallets: from .env (BLACKLIST_SOURCES) + wallets sent by the client */
export function getBlacklistSources(fromClient: unknown): string[] {
  const fromEnv = (process.env.BLACKLIST_SOURCES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const extra = Array.isArray(fromClient)
    ? fromClient.filter((x): x is string => typeof x === "string").slice(0, 5)
    : [];
  return [...new Set([...fromEnv, ...extra])];
}
