import { Connection, PublicKey, type ParsedAccountData } from "@solana/web3.js";
import { checkToken, type RiskLevel } from "@/lib/tokenRisk";

/**
 * Veris Shield - wallet health scan.
 * Lists every token account of a wallet and flags:
 *  - risky tokens (same on-chain report as the token scanner)
 *  - spending approvals ("delegate"): someone else may move these tokens without asking again
 *  - frozen accounts: the token creator has locked these tokens
 */

const TOKEN_PROGRAMS = [
  new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
];
// Each token report costs several RPC calls; the public devnet RPC rate-limits, so cap it
const MAX_TOKENS_CHECKED = 8;

export type Holding = {
  account: string; // token account address
  tokenProgram: string;
  mint: string;
  symbol: string | null;
  amount: string; // UI amount
  rawAmount: string; // base units, for building approve / revoke instructions
  frozen: boolean;
  delegate: string | null;
  delegatedAmount: string | null;
  level: RiskLevel | null; // null = not checked (cap reached / read failed)
  riskScore: number | null;
  summary: string | null;
};

export type WalletScanResult = {
  owner: string;
  holdings: Holding[];
  approvals: number;
  frozen: number;
  dangerousTokens: number;
  scannedAt: string;
};

type TokenAccountInfo = {
  mint: string;
  state: "initialized" | "frozen" | "uninitialized";
  tokenAmount: { uiAmountString: string; amount: string };
  delegate?: string;
  delegatedAmount?: { uiAmountString: string };
};

export async function scanWallet(connection: Connection, ownerAddress: string): Promise<WalletScanResult> {
  const owner = new PublicKey(ownerAddress);
  const pages = await Promise.all(
    TOKEN_PROGRAMS.map((programId) => connection.getParsedTokenAccountsByOwner(owner, { programId }))
  );

  const holdings: Holding[] = pages.flatMap((page, i) =>
    page.value.map(({ pubkey, account }) => {
      const info = (account.data as ParsedAccountData).parsed.info as TokenAccountInfo;
      return {
        account: pubkey.toBase58(),
        tokenProgram: TOKEN_PROGRAMS[i].toBase58(),
        mint: info.mint,
        symbol: null,
        amount: info.tokenAmount.uiAmountString,
        rawAmount: info.tokenAmount.amount,
        frozen: info.state === "frozen",
        delegate: info.delegate ?? null,
        delegatedAmount: info.delegatedAmount?.uiAmountString ?? null,
        level: null,
        riskScore: null,
        summary: null,
      };
    })
  );

  // Approvals and frozen accounts first, then the largest balances
  holdings.sort(
    (a, b) =>
      Number(!!b.delegate) - Number(!!a.delegate) ||
      Number(b.frozen) - Number(a.frozen) ||
      Number(b.amount) - Number(a.amount)
  );

  const mints = [...new Set(holdings.map((h) => h.mint))].slice(0, MAX_TOKENS_CHECKED);
  for (const mint of mints) {
    try {
      const report = await checkToken(connection, mint);
      for (const h of holdings.filter((x) => x.mint === mint)) {
        h.symbol = report.symbol;
        h.level = report.level;
        h.riskScore = report.riskScore;
        h.summary = report.summary;
      }
    } catch (e) {
      console.warn("[walletScan] token check failed", mint, e);
    }
  }

  return {
    owner: ownerAddress,
    holdings,
    approvals: holdings.filter((h) => h.delegate).length,
    frozen: holdings.filter((h) => h.frozen).length,
    dangerousTokens: holdings.filter((h) => h.level === "danger").length,
    scannedAt: new Date().toISOString(),
  };
}
