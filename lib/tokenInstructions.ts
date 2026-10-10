import { Buffer } from "buffer";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/**
 * Minimal SPL Token instructions (same layout for Token and Token-2022), built by hand so the
 * browser bundle does not need @solana/spl-token.
 */

const APPROVE = 4;
const REVOKE = 5;

/** Remove the spending approval ("delegate") from a token account. Signed by the account owner. */
export function revokeInstruction(account: PublicKey, owner: PublicKey, programId: PublicKey) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([REVOKE]),
  });
}

/** Let `delegate` move up to `amount` (base units) out of the account. Used only by the devnet demo. */
export function approveInstruction(
  account: PublicKey,
  delegate: PublicKey,
  owner: PublicKey,
  amount: bigint,
  programId: PublicKey
) {
  const data = Buffer.alloc(9);
  data.writeUInt8(APPROVE, 0);
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}
