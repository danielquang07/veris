import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
} from "@solana/web3.js";
import idl from "@/lib/idl/veris_market.json";

/**
 * Minimal client for the veris_market Anchor program (anchor/programs/veris_market).
 * Instructions are encoded by hand from the IDL (discriminator + borsh args), so the
 * frontend only needs @solana/web3.js.
 */

export const MARKET_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID || idl.address
);

export const LAMPORTS_PER_SOL = 1_000_000_000;

type IxName =
  | "init_config"
  | "create_trade"
  | "deposit"
  | "pay_remainder"
  | "confirm_delivery"
  | "claim_timeout"
  | "open_dispute"
  | "resolve_dispute"
  | "unfreeze"
  | "close_trade";

function discriminator(name: IxName): Buffer {
  const ix = idl.instructions.find((i) => i.name === name);
  if (!ix) throw new Error(`Unknown instruction ${name}`);
  return Buffer.from(ix.discriminator);
}

// ---------------------------------------------------------------- borsh helpers

const u64 = (v: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
};
const i64 = (v: bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(v);
  return b;
};
const str = (s: string) => {
  const bytes = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
};

// ---------------------------------------------------------------- PDAs

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], MARKET_PROGRAM_ID)[0];
}

export function tradePda(buyer: PublicKey, tradeId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("trade"), buyer.toBuffer(), u64(tradeId)],
    MARKET_PROGRAM_ID
  )[0];
}

// ---------------------------------------------------------------- accounts

export const TRADE_STATUSES = [
  "awaiting_deposit",
  "deposited",
  "paid",
  "completed",
  "frozen",
  "cancelled",
] as const;
export type OnChainStatus = (typeof TRADE_STATUSES)[number];

export type OnChainTrade = {
  address: PublicKey;
  tradeId: bigint;
  buyer: PublicKey;
  seller: PublicKey;
  item: string;
  value: bigint;
  deposit: bigint;
  buyerDeposited: boolean;
  sellerDeposited: boolean;
  remainderPaid: boolean;
  balance: bigint;
  status: OnChainStatus;
  statusBeforeFreeze: OnChainStatus;
  stageSecs: bigint;
  deadline: bigint;
};

export function decodeTrade(address: PublicKey, data: Buffer): OnChainTrade {
  const expected = Buffer.from(idl.accounts.find((a) => a.name === "Trade")!.discriminator);
  if (!data.subarray(0, 8).equals(expected)) throw new Error("Không phải tài khoản kèo Veris");
  let o = 8;
  const readU64 = () => {
    const v = data.readBigUInt64LE(o);
    o += 8;
    return v;
  };
  const readI64 = () => {
    const v = data.readBigInt64LE(o);
    o += 8;
    return v;
  };
  const readKey = () => {
    const k = new PublicKey(data.subarray(o, o + 32));
    o += 32;
    return k;
  };
  const readBool = () => data[o++] === 1;
  const readStatus = () => TRADE_STATUSES[data[o++]];

  const tradeId = readU64();
  const buyer = readKey();
  const seller = readKey();
  const len = data.readUInt32LE(o);
  o += 4;
  const item = data.subarray(o, o + len).toString("utf8");
  o += len;
  return {
    address,
    tradeId,
    buyer,
    seller,
    item,
    value: readU64(),
    deposit: readU64(),
    buyerDeposited: readBool(),
    sellerDeposited: readBool(),
    remainderPaid: readBool(),
    balance: readU64(),
    status: readStatus(),
    statusBeforeFreeze: readStatus(),
    stageSecs: readI64(),
    deadline: readI64(),
  };
}

export async function fetchTrade(connection: Connection, address: PublicKey): Promise<OnChainTrade | null> {
  const acc = await connection.getAccountInfo(address, "confirmed");
  if (!acc) return null;
  return decodeTrade(address, acc.data);
}

export async function fetchConfigAdmin(connection: Connection): Promise<PublicKey | null> {
  const acc = await connection.getAccountInfo(configPda(), "confirmed");
  if (!acc) return null;
  return new PublicKey(acc.data.subarray(8, 40));
}

// ---------------------------------------------------------------- instructions

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
  pubkey,
  isSigner,
  isWritable,
});

function ix(name: IxName, keys: ReturnType<typeof meta>[], args: Buffer[] = []) {
  return new TransactionInstruction({
    programId: MARKET_PROGRAM_ID,
    keys,
    data: Buffer.concat([discriminator(name), ...args]),
  });
}

export const marketIx = {
  initConfig: (admin: PublicKey) =>
    ix("init_config", [
      meta(admin, true, true),
      meta(configPda(), false, true),
      meta(SystemProgram.programId, false, false),
    ]),

  createTrade: (buyer: PublicKey, seller: PublicKey, tradeId: bigint, value: bigint, item: string, stageSecs: bigint) =>
    ix(
      "create_trade",
      [
        meta(buyer, true, true),
        meta(seller, false, false),
        meta(tradePda(buyer, tradeId), false, true),
        meta(SystemProgram.programId, false, false),
      ],
      [u64(tradeId), u64(value), str(item), i64(stageSecs)]
    ),

  deposit: (party: PublicKey, trade: PublicKey) =>
    ix("deposit", [
      meta(party, true, true),
      meta(trade, false, true),
      meta(SystemProgram.programId, false, false),
    ]),

  payRemainder: (buyer: PublicKey, trade: PublicKey) =>
    ix("pay_remainder", [
      meta(buyer, true, true),
      meta(trade, false, true),
      meta(SystemProgram.programId, false, false),
    ]),

  confirmDelivery: (signer: PublicKey, t: OnChainTrade) =>
    ix("confirm_delivery", [
      meta(signer, true, false),
      meta(configPda(), false, false),
      meta(t.address, false, true),
      meta(t.buyer, false, true),
      meta(t.seller, false, true),
    ]),

  claimTimeout: (caller: PublicKey, t: OnChainTrade) =>
    ix("claim_timeout", [
      meta(caller, true, false),
      meta(t.address, false, true),
      meta(t.buyer, false, true),
      meta(t.seller, false, true),
    ]),

  openDispute: (party: PublicKey, trade: PublicKey) =>
    ix("open_dispute", [meta(party, true, false), meta(trade, false, true)]),

  resolveDispute: (admin: PublicKey, t: OnChainTrade, outcome: "buyer_right" | "seller_right" | "refund_both") =>
    ix(
      "resolve_dispute",
      [
        meta(admin, true, false),
        meta(configPda(), false, false),
        meta(t.address, false, true),
        meta(t.buyer, false, true),
        meta(t.seller, false, true),
      ],
      [Buffer.from([["buyer_right", "seller_right", "refund_both"].indexOf(outcome)])]
    ),

  unfreeze: (admin: PublicKey, t: OnChainTrade) =>
    ix("unfreeze", [
      meta(admin, true, false),
      meta(configPda(), false, false),
      meta(t.address, false, true),
      meta(t.buyer, false, true),
      meta(t.seller, false, true),
    ]),

  closeTrade: (buyer: PublicKey, trade: PublicKey) =>
    ix("close_trade", [meta(buyer, true, true), meta(trade, false, true)]),
};

/** Send one instruction with the connected wallet, wait for confirmation, return the Solscan link */
export async function sendMarketIx(
  connection: Connection,
  feePayer: PublicKey,
  sendTransaction: (tx: Transaction, c: Connection) => Promise<string>,
  instruction: TransactionInstruction
): Promise<{ signature: string; solscanLink: string }> {
  const tx = new Transaction().add(instruction);
  tx.feePayer = feePayer;
  const signature = await sendTransaction(tx, connection);
  const blockhash = await connection.getLatestBlockhash();
  const res = await connection.confirmTransaction({ signature, ...blockhash }, "confirmed");
  if (res.value.err) throw new Error(explainError(JSON.stringify(res.value.err)));
  return { signature, solscanLink: `https://solscan.io/tx/${signature}?cluster=devnet` };
}

// Program error codes (anchor/programs/veris_market/src/error.rs), in declaration order from 6000
const ERROR_TEXT = [
  "Giá trị kèo phải lớn hơn 0",
  "Người mua và người bán không được trùng ví",
  "Tên vật phẩm quá dài",
  "Thời hạn mỗi bước không hợp lệ",
  "Ví này không phải một bên của kèo",
  "Chỉ admin của chợ mới làm được việc này",
  "Chỉ người mua hoặc admin mới xác nhận giao hàng được",
  "Kèo không ở đúng bước cho thao tác này",
  "Bên này đã cọc rồi",
  "Đã quá hạn bước này",
  "Chưa tới hạn",
  "Kèo vẫn còn tiền chưa giải ngân",
  "Lỗi tính toán",
];

/** Turn a raw wallet / program error into a Vietnamese message for players */
export function explainError(raw: string): string {
  const hex = raw.match(/custom program error: 0x([0-9a-f]+)/i);
  const dec = raw.match(/"Custom":\s*(\d+)/);
  const code = hex ? parseInt(hex[1], 16) : dec ? Number(dec[1]) : null;
  if (code !== null && code >= 6000 && code - 6000 < ERROR_TEXT.length) return ERROR_TEXT[code - 6000];
  if (/insufficient (funds|lamports)|0x1\b/i.test(raw)) return "Ví không đủ SOL (devnet) để thực hiện giao dịch";
  if (/User rejected|rejected the request/i.test(raw)) return "Bạn đã từ chối ký giao dịch";
  return raw;
}

export const formatSol = (lamports: bigint) =>
  (Number(lamports) / LAMPORTS_PER_SOL).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
