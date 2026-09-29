"use client";

import { Buffer } from "buffer";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

// Required: browsers have no built-in Buffer, but the Solana library needs it.
// Without these 3 lines you get "Buffer is not defined" - the most common error.
if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
}

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  // Use a private RPC if available (much faster), otherwise the public RPC
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet"),
    []
  );

  // An empty array is correct: Phantom registers itself via the Wallet Standard
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
