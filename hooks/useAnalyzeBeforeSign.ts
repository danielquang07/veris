"use client";

import { useCallback, useRef, useState } from "react";
import type { RiskAnalysis, SignGuardContext, SignGuardDecision } from "@/lib/risk-types";

const TIMEOUT_MS = 10000;
const RISK_THRESHOLD = 70;

export function useAnalyzeBeforeSign() {
  const [pending, setPending] = useState<SignGuardContext | null>(null);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((d: SignGuardDecision) => void) | null>(null);

  const checkBeforeSign = useCallback(async (ctx: SignGuardContext): Promise<SignGuardDecision> => {
    if (process.env.NEXT_PUBLIC_AI_ENABLED !== "true") {
      return { proceed: true };
    }

    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: ctx.text ?? "",
          subject_pubkey: ctx.tokenMint ?? ctx.recipient ?? null,
          tx_type: ctx.txType,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn("[useAnalyzeBeforeSign] analyze failed", res.status);
        return { proceed: true };
      }

      const data: RiskAnalysis = await res.json();

      if (data.risk_score < RISK_THRESHOLD) {
        return { proceed: true, analysis: data };
      }

      return new Promise<SignGuardDecision>((resolve) => {
        resolveRef.current = resolve;
        setPending(ctx);
        setAnalysis(data);
      });
    } catch (e) {
      console.warn("[useAnalyzeBeforeSign] error, fail-open", e);
      return { proceed: true };
    } finally {
      setLoading(false);
    }
  }, []);

  const userContinue = useCallback(() => {
    resolveRef.current?.({ proceed: true, analysis: analysis ?? undefined });
    resolveRef.current = null;
    setPending(null);
    setAnalysis(null);
  }, [analysis]);

  const userCancel = useCallback(() => {
    resolveRef.current?.({ proceed: false, reason: "user-cancelled", analysis: analysis ?? undefined });
    resolveRef.current = null;
    setPending(null);
    setAnalysis(null);
  }, [analysis]);

  return { checkBeforeSign, pending, analysis, loading, userContinue, userCancel };
}
