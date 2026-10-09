export type LegalRef = {
  dieu: string;
  khoan: string;
  noi_dung: string;
  link: string;
  van_ban?: string;
  pattern?: string;
};

export type OnChainContext = {
  report_count: number;
  recent_tx_count: number;
  wallet_age_days: number | null;
};

export type RiskAnalysis = {
  risk_score: number;
  label: string;
  signals: string[];
  legal_refs: LegalRef[];
  on_chain_context?: OnChainContext | null;
};

export type SignGuardContext = {
  tokenMint?: string;
  recipient?: string;
  text?: string;
  txType: "swap" | "transfer" | "bridge" | "other";
  metadata?: Record<string, unknown>;
};

export type SignGuardDecision =
  | { proceed: true; analysis?: RiskAnalysis }
  | { proceed: false; reason: "user-cancelled" | "high-risk" | "error"; analysis?: RiskAnalysis };
