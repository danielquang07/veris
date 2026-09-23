import { Buffer } from "buffer";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Connection,
} from "@solana/web3.js";

// Program co san cua Solana de dinh text vao giao dich.
// Nho no, ta ghi duoc du lieu len blockchain ma KHONG can viet smart contract.
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function taoInstructionMemo(nguoiKy: PublicKey, noiDung: string) {
  return new TransactionInstruction({
    keys: [{ pubkey: nguoiKy, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(noiDung, "utf8"),
  });
}

/** Gui mot giao dich chi chua memo. Tra ve link Solscan devnet. */
export async function ghiBangChung(
  connection: Connection,
  nguoiKy: PublicKey,
  sendTransaction: (tx: Transaction, c: Connection) => Promise<string>,
  noiDung: string
): Promise<{ chuKy: string; linkSolscan: string }> {
  const tx = new Transaction().add(taoInstructionMemo(nguoiKy, noiDung));

  const chuKy = await sendTransaction(tx, connection);

  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature: chuKy, ...blockhash },
    "confirmed"
  );

  return {
    chuKy,
    linkSolscan: `https://solscan.io/tx/${chuKy}?cluster=devnet`,
  };
}
