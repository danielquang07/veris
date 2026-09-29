export type Report = {
  signature: string; // transaction signature on Solana
  reporterWallet: string; // who sent this report
  reportedWallet: string; // address being reported
  time: string;
  severity: number; // 1-5
};

/**
 * Score the risk of an address based on the reports already on chain.
 * Entirely a fixed formula - run it 10 times, get 10 identical results.
 * The AI does NOT take part in this step.
 */
export function scoreOnChain(reports: Report[], walletToCheck: string) {
  const related = reports.filter((b) => b.reportedWallet === walletToCheck);

  // Count DISTINCT WALLETS, not the number of transactions
  // -> stops one person spamming 10 fake reports
  const reporterWallets = new Set(related.map((b) => b.reporterWallet));
  const reporterCount = reporterWallets.size;

  const averageSeverity =
    related.length > 0
      ? related.reduce((s, b) => s + b.severity, 0) / related.length
      : 0;

  const firstReportedAt =
    related.length > 0 ? related.map((b) => b.time).sort()[0] : null;

  // Threshold taken from the old ScamRegistry logic: 10 reporters -> flag
  const flagged = reporterCount >= 10;

  return {
    walletToCheck,
    reportCount: related.length,
    reporterCount,
    averageSeverity: Number(averageSeverity.toFixed(2)),
    firstReportedAt,
    flagged,
  };
}
