"use client";

import { Buffer } from "buffer";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

// Bat buoc: trinh duyet khong co san Buffer, thu vien Solana lai can no.
// Thieu 3 dong nay se gap loi "Buffer is not defined" - loi pho bien nhat.
if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
}

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  // Dung RPC rieng neu co (nhanh hon nhieu), khong thi dung RPC cong cong
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet"),
    []
  );

  // Mang rong la dung: Phantom tu dang ky theo chuan Wallet Standard
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
