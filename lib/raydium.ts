import BN from "bn.js";
import {
  CurveCalculator,
  DEV_API_URLS,
  FeeOn,
  Percent,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey, Transaction, type Connection } from "@solana/web3.js";

/**
 * Raydium CPMM on Solana Devnet - the same program and pools as the DEX of the main
 * Hao Khi Dai Viet project (github.com/duynguyen658/gamedefi, docs/defi.md), so these
 * features plug straight into that DEX.
 */

export const CPMM_PROGRAM_ID = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb";
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export type PoolSymbol = "USDC" | "USDT";

export const DEX_POOLS: Record<PoolSymbol, { id: string; mint: string; decimals: number }> = {
  USDC: { id: "FeRts7d5DfXKXq1hGMkeiGEHayDdjsmSyJ41rHVcKo8t", mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
  USDT: { id: "Bw9gaeKqQy5aTpi1BiSdV2p21REATtVXDdhjPUFjgq6N", mint: "9jWfcfEZToquBQmkoEViNSCt72veXwcvRGFQERXRjEk1", decimals: 6 },
};

const SOL_DECIMALS = 9;
const FEE_RATE_DENOMINATOR = 1_000_000;

// ---------------------------------------------------------------- amounts

export function toBaseUnits(ui: string, decimals: number): BN {
  const [whole, frac = ""] = ui.trim().replace(",", ".").split(".");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) throw new Error("Số lượng không hợp lệ");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return new BN((whole || "0") + padded);
}

export function fromBaseUnits(raw: BN | bigint | string, decimals: number, maxFraction = 6): string {
  const s = raw.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, maxFraction).replace(/0+$/, "");
  return Number(whole).toLocaleString("vi-VN") + (frac ? `,${frac}` : "");
}

const toNumber = (raw: BN, decimals: number) => Number(raw.toString()) / 10 ** decimals;

// ---------------------------------------------------------------- SDK

let cached: { key: string; raydium: Promise<Raydium> } | null = null;

function loadRaydium(connection: Connection, owner?: PublicKey): Promise<Raydium> {
  const key = `${connection.rpcEndpoint}|${owner?.toBase58() ?? ""}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      raydium: Raydium.load({
        owner,
        connection,
        cluster: "devnet",
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: "finalized",
        urlConfigs: DEV_API_URLS,
      }),
    };
    cached.raydium.catch(() => (cached = null));
  }
  return cached.raydium;
}

async function loadPool(connection: Connection, symbol: PoolSymbol, owner?: PublicKey) {
  const raydium = await loadRaydium(connection, owner);
  const pool = DEX_POOLS[symbol];
  const data = await raydium.cpmm.getPoolInfoFromRpc(pool.id);
  const mints = [data.poolInfo.mintA.address, data.poolInfo.mintB.address];
  if (data.poolInfo.programId !== CPMM_PROGRAM_ID || !mints.includes(WSOL_MINT) || !mints.includes(pool.mint))
    throw new Error("Pool Raydium không khớp cấu hình SOL / token thử");
  return { raydium, ...data };
}

// ---------------------------------------------------------------- pool stats (check liquidity)

export type PoolStats = {
  symbol: PoolSymbol;
  poolId: string;
  lpMint: string;
  solReserve: number;
  tokenReserve: number;
  /** token per 1 SOL */
  price: number;
  /** Total value locked, counted in SOL (both sides of a constant-product pool are worth the same) */
  tvlSol: number;
  feePercent: number;
  lpSupply: BN;
  lpDecimals: number;
};

export async function getPoolStats(connection: Connection, symbol: PoolSymbol): Promise<PoolStats> {
  const { poolInfo, rpcData } = await loadPool(connection, symbol);
  const solIsA = poolInfo.mintA.address === WSOL_MINT;
  const solRaw = solIsA ? rpcData.baseReserve : rpcData.quoteReserve;
  const tokenRaw = solIsA ? rpcData.quoteReserve : rpcData.baseReserve;
  const solReserve = toNumber(solRaw, SOL_DECIMALS);
  const tokenReserve = toNumber(tokenRaw, DEX_POOLS[symbol].decimals);
  return {
    symbol,
    poolId: poolInfo.id,
    lpMint: poolInfo.lpMint.address,
    solReserve,
    tokenReserve,
    price: tokenReserve / solReserve,
    tvlSol: solReserve * 2,
    feePercent: (Number(rpcData.configInfo?.tradeFeeRate ?? 0) / FEE_RATE_DENOMINATOR) * 100,
    lpSupply: rpcData.lpAmount,
    lpDecimals: poolInfo.lpMint.decimals,
  };
}

/**
 * Selling `amountIn` of one side into a constant-product pool (x * y = k).
 * impactPercent: how much worse the executed price is than the current pool price,
 * excluding the pool fee (the fee is shown separately).
 */
export function priceImpact(stats: PoolStats, amountIn: number, inputIsSol: boolean) {
  const fee = stats.feePercent / 100;
  const x = inputIsSol ? stats.solReserve : stats.tokenReserve;
  const y = inputIsSol ? stats.tokenReserve : stats.solReserve;
  const inAfterFee = amountIn * (1 - fee);
  const out = (y * inAfterFee) / (x + inAfterFee);
  const spot = y / x;
  const impact = inAfterFee > 0 ? 1 - out / (inAfterFee * spot) : 0;
  return { out, impactPercent: Math.max(0, impact * 100) };
}

// ---------------------------------------------------------------- wallet balances

export async function getBalances(connection: Connection, owner: PublicKey, mints: string[]) {
  const [sol, ...tokens] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    ...mints.map((mint) =>
      connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) }, "confirmed")
    ),
  ]);
  const byMint: Record<string, BN> = {};
  mints.forEach((mint, i) => {
    byMint[mint] = tokens[i].value.reduce(
      (sum, acc) => sum.add(new BN(acc.account.data.parsed.info.tokenAmount.amount)),
      new BN(0)
    );
  });
  return { sol: new BN(sol), tokens: byMint };
}

// ---------------------------------------------------------------- transactions

async function finalizeTx(connection: Connection, tx: unknown, owner: PublicKey): Promise<Transaction> {
  if (!(tx instanceof Transaction)) throw new Error("Raydium không tạo được giao dịch legacy hợp lệ");
  tx.feePayer = owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
  const keys = tx.compileMessage().accountKeys.map((k) => k.toBase58());
  if (!keys.includes(CPMM_PROGRAM_ID) || keys[0] !== owner.toBase58())
    throw new Error("Giao dịch không gọi đúng program Raydium hoặc sai ví trả phí");
  // Phantom only says "Unexpected error" for a transaction that cannot run - simulate first
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    const detail =
      sim.value.logs?.filter((l) => l.startsWith("Program log: Error:") || l.includes("failed:")).pop() ??
      JSON.stringify(sim.value.err);
    throw new Error(`Giao dịch không qua mô phỏng Devnet: ${detail}`);
  }
  return tx;
}

export async function buildSwapTx(
  connection: Connection,
  owner: PublicKey,
  symbol: PoolSymbol,
  inputIsSol: boolean,
  amountUi: string,
  slippageBps: number
) {
  const { raydium, poolInfo, poolKeys, rpcData } = await loadPool(connection, symbol, owner);
  const inputMint = inputIsSol ? WSOL_MINT : DEX_POOLS[symbol].mint;
  const inputAmount = toBaseUnits(amountUi, inputIsSol ? SOL_DECIMALS : DEX_POOLS[symbol].decimals);
  if (inputAmount.isZero()) throw new Error("Nhập số lượng lớn hơn 0");
  const baseIn = inputMint === poolInfo.mintA.address;
  const creatorFeeOnInput = rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB;
  const swapResult = CurveCalculator.swapBaseInput(
    inputAmount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo!.tradeFeeRate,
    rpcData.configInfo!.creatorFeeRate,
    rpcData.configInfo!.protocolFeeRate,
    rpcData.configInfo!.fundFeeRate,
    creatorFeeOnInput
  );
  const built = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    inputAmount,
    swapResult,
    slippage: slippageBps / 10_000,
    baseIn,
    txVersion: TxVersion.LEGACY,
  });
  const outDecimals = inputIsSol ? DEX_POOLS[symbol].decimals : SOL_DECIMALS;
  const minOut = swapResult.outputAmount.mul(new BN(10_000 - slippageBps)).div(new BN(10_000));
  return {
    tx: await finalizeTx(connection, built.transaction, owner),
    expectedOut: fromBaseUnits(swapResult.outputAmount, outDecimals),
    minOut: fromBaseUnits(minOut, outDecimals),
  };
}

/** Deposit SOL plus the matching amount of token (the pool ratio decides it) and receive LP tokens */
export async function buildAddLiquidityTx(
  connection: Connection,
  owner: PublicKey,
  symbol: PoolSymbol,
  solAmountUi: string,
  slippagePercent = 1
) {
  const { raydium, poolInfo, poolKeys, rpcData } = await loadPool(connection, symbol, owner);
  const solIsA = poolInfo.mintA.address === WSOL_MINT;
  const inputAmount = toBaseUnits(solAmountUi, SOL_DECIMALS);
  if (inputAmount.isZero()) throw new Error("Nhập số SOL lớn hơn 0");

  // Deposits keep the pool ratio: token = sol * tokenReserve / solReserve (rounded up),
  // LP minted = sol * lpSupply / solReserve. Shown to the player before signing.
  const solReserve = solIsA ? rpcData.baseReserve : rpcData.quoteReserve;
  const tokenReserve = solIsA ? rpcData.quoteReserve : rpcData.baseReserve;
  const tokenNeeded = inputAmount.mul(tokenReserve).add(solReserve.subn(1)).div(solReserve);
  const lpExpected = inputAmount.mul(rpcData.lpAmount).div(solReserve);

  // No computeResult: the SDK then converts the LP supply units itself (passing our own
  // computePairAmount result made it mint an LP amount in the wrong unit)
  const built = await raydium.cpmm.addLiquidity({
    poolInfo,
    poolKeys,
    inputAmount,
    baseIn: solIsA,
    slippage: new Percent(slippagePercent, 100),
    txVersion: TxVersion.LEGACY,
  });
  return {
    tx: await finalizeTx(connection, built.transaction, owner),
    tokenNeeded,
    tokenNeededUi: fromBaseUnits(tokenNeeded, DEX_POOLS[symbol].decimals),
    lpExpectedUi: fromBaseUnits(lpExpected, poolInfo.lpMint.decimals),
  };
}

/** Return LP tokens and get back this share of both reserves (plus the fees earned meanwhile) */
export async function buildWithdrawLiquidityTx(
  connection: Connection,
  owner: PublicKey,
  symbol: PoolSymbol,
  lpAmount: BN,
  slippagePercent = 1
) {
  const { raydium, poolInfo, poolKeys } = await loadPool(connection, symbol, owner);
  if (lpAmount.isZero()) throw new Error("Chưa có LP token để rút");
  const built = await raydium.cpmm.withdrawLiquidity({
    poolInfo,
    poolKeys,
    lpAmount,
    slippage: new Percent(slippagePercent, 100),
    txVersion: TxVersion.LEGACY,
    closeWsol: true,
  });
  return { tx: await finalizeTx(connection, built.transaction, owner) };
}

/** Sign with the connected wallet, send, wait for confirmation; returns a Solscan link */
export async function sendTx(
  connection: Connection,
  sendTransaction: (tx: Transaction, c: Connection) => Promise<string>,
  tx: Transaction
) {
  const signature = await sendTransaction(tx, connection);
  const latest = await connection.getLatestBlockhash("finalized");
  const res = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (res.value.err) throw new Error(`Giao dịch thất bại: ${JSON.stringify(res.value.err)}`);
  return { signature, solscanLink: `https://solscan.io/tx/${signature}?cluster=devnet` };
}

export function explainTxError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/User rejected|rejected the request/i.test(msg)) return "Bạn đã từ chối ký giao dịch";
  if (/insufficient (funds|lamports)|0x1\b/i.test(msg)) return "Ví không đủ số dư (devnet) cho giao dịch này";
  return msg;
}

