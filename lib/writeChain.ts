import { Buffer } from "buffer";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Connection,
} from "@solana/web3.js";

// Built-in Solana program for attaching text to a transaction.
// Thanks to it, we can write data to the blockchain WITHOUT writing a smart contract.
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function createMemoInstruction(signer: PublicKey, content: string) {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(content, "utf8"),
  });
}

/** Send a transaction containing only a memo. Returns a Solscan devnet link. */
export async function writeEvidence(
  connection: Connection,
  signer: PublicKey,
  sendTransaction: (tx: Transaction, c: Connection) => Promise<string>,
  content: string
): Promise<{ signature: string; solscanLink: string }> {
  const tx = new Transaction().add(createMemoInstruction(signer, content));

  const signature = await sendTransaction(tx, connection);

  const blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature, ...blockhash },
    "confirmed"
  );

  return {
    signature,
    solscanLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
  };
}

export async function buildEvidenceTx(
  connection: Connection,
  payer: PublicKey,
  memo: string
): Promise<Transaction> {
  const ix = createMemoInstruction(payer, memo);
  const tx = new Transaction().add(ix);
  tx.feePayer = payer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

export function buildAiEvidenceMemo(result: {
  risk_score: number;
  label: string;
  signals?: string[];
}): string {
  const json = JSON.stringify(result);
  const hashShort = Buffer.from(json).toString("base64").slice(0, 16);
  return `VERISAI|v1|score=${result.risk_score}|label=${result.label}|hash=${hashShort}`;
}
