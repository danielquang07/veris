"use client";

import { useCallback, useRef, useState } from "react";
import type { TokenRiskReport } from "@/lib/tokenRisk";

const TIMEOUT_MS = 15_000;

/**
 * Veris Shield gate before signing: check the token the user is about to buy (or deposit).
 * Dangerous token -> resolve only after the user picks Cancel / Continue in the modal.
 * Check unavailable -> let the trade through (fail-open) so a slow RPC never blocks trading.
 */
export function useTokenGuard() {
  const [report, setReport] = useState<TokenRiskReport | null>(null);
  const [checking, setChecking] = useState(false);
  const resolveRef = useRef<((proceed: boolean) => void) | null>(null);

  const guard = useCallback(async (mint: string): Promise<boolean> => {
    setChecking(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`/api/token-check?mint=${encodeURIComponent(mint)}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return true;
      const data: TokenRiskReport = await res.json();
      if (data.level !== "danger") return true;
      return await new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setReport(data);
      });
    } catch (e) {
      console.warn("[useTokenGuard] check failed, fail-open", e);
      return true;
    } finally {
      setChecking(false);
    }
  }, []);

  const decide = useCallback((proceed: boolean) => {
    resolveRef.current?.(proceed);
    resolveRef.current = null;
    setReport(null);
  }, []);

  return { guard, checking, report, onCancel: () => decide(false), onContinue: () => decide(true) };
}
