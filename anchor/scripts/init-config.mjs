// One-time setup after deploying veris_market: create the Config PDA, optionally hand admin to another wallet.
// usage: node anchor/scripts/init-config.mjs <deployer-keypair.json> [new-admin-address]
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const idl = JSON.parse(readFileSync(new URL("../../lib/idl/veris_market.json", import.meta.url), "utf8"));
const programId = new PublicKey(idl.address);
const disc = (name) => Buffer.from(idl.instructions.find((i) => i.name === name).discriminator);

const [keypairPath, newAdmin] = process.argv.slice(2);
if (!keypairPath) {
  console.error("usage: node anchor/scripts/init-config.mjs <deployer-keypair.json> [new-admin-address]");
  process.exit(1);
}
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf8"))));
const connection = new Connection(process.env.RPC_URL || clusterApiUrl("devnet"), "confirmed");
const config = PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];

const existing = await connection.getAccountInfo(config);
if (!existing) {
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc("init_config"),
  });
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
  console.log("init_config:", sig);
} else {
  console.log("Config already exists, admin =", new PublicKey(existing.data.subarray(8, 40)).toBase58());
}

if (newAdmin) {
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([disc("set_admin"), new PublicKey(newAdmin).toBuffer()]),
  });
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
  console.log("set_admin ->", newAdmin, sig);
}
