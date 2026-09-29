import { PublicKey } from "@solana/web3.js";

export type Chain = "sol" | "sui";

export const CHAIN_NAME: Record<Chain, string> = { sol: "Solana", sui: "Sui" };

// Solana: base58, 32-44 chars. The regex runs first because new PublicKey() also
// accepts strings that decode to fewer than 32 bytes (e.g. "11111").
const SOL_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Sui: 0x + 64 hex chars (user wallet addresses are always full length)
const SUI_REGEX = /^0x[0-9a-fA-F]{64}$/;

export function isValidAddress(chain: Chain, address: string): boolean {
  if (chain === "sui") return SUI_REGEX.test(address);
  if (!SOL_REGEX.test(address)) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/** Guess which chain an address belongs to - used for "this is a Sui address, you are withdrawing SOL" */
export function guessChain(address: string): Chain | null {
  if (isValidAddress("sui", address)) return "sui";
  if (isValidAddress("sol", address)) return "sol";
  return null;
}

/** Comparable form: Sui is case-insensitive, Solana base58 is case-sensitive */
export function normalizeAddress(chain: Chain, address: string): string {
  const s = address.trim();
  return chain === "sui" ? s.toLowerCase() : s;
}

export function sameAddress(chain: Chain, a: string, b: string): boolean {
  return normalizeAddress(chain, a) === normalizeAddress(chain, b);
}

/**
 * Lookalike address (address poisoning): scammers generate a fresh wallet whose first
 * and last few chars match a wallet the victim knows, because people only glance at
 * the ends when copying. Threshold: >= 3 matching chars at each end and >= 7 in total -
 * a random base58 collision at that level is ~58^-7, effectively impossible.
 */
export function isLookalikeAddress(chain: Chain, address: string, knownWallet: string): boolean {
  const strip0x = (s: string) => (chain === "sui" ? s.slice(2) : s);
  const a = strip0x(normalizeAddress(chain, address));
  const b = strip0x(normalizeAddress(chain, knownWallet));
  if (a === b) return false;

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;

  return head >= 3 && tail >= 3 && head + tail >= 7;
}

/** Find every Solana / Sui wallet address that appears in a chat transcript */
export function extractAddresses(text: string): { chain: Chain; address: string }[] {
  const found: { chain: Chain; address: string }[] = [];
  const seen = new Set<string>();

  const SUI_IN_TEXT = /0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g;
  for (const m of text.matchAll(SUI_IN_TEXT)) {
    const address = m[0].toLowerCase();
    if (!seen.has(address)) {
      seen.add(address);
      found.push({ chain: "sui", address });
    }
  }
  // Remove Sui addresses first so a hex run is never mistaken for a Solana address
  const rest = text.replace(SUI_IN_TEXT, " ");
  for (const m of rest.matchAll(
    /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/g
  )) {
    const address = m[0];
    if (!seen.has(address) && isValidAddress("sol", address)) {
      seen.add(address);
      found.push({ chain: "sol", address });
    }
  }
  return found;
}

export function shortenAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}
