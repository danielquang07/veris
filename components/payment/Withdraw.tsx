"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import type { WithdrawCheckResult } from "@/app/api/withdraw-check/route";
import { shortenAddress, type Chain } from "@/lib/address";
import { apiUrl } from "@/lib/api";
import { SAMPLE_WALLETS, makeLookalike } from "@/lib/paymentSamples";
import {
  Chip,
  ErrorBox,
  Label,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/payment/ui";

/** Mode 1 - withdraw game earnings (SUI or SOL) to your own wallet */
export function Withdraw() {
  const { publicKey } = useWallet();
  const [chain, setChain] = useState<Chain>("sol");
  const [amount, setAmount] = useState("5");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<WithdrawCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);

  // Wallets linked to the game account. The connected Phantom wallet stands in for the
  // player's Solana wallet; without Phantom a sample wallet is used.
  const linked: Record<Chain, string> = {
    sol: publicKey?.toBase58() ?? SAMPLE_WALLETS.sol.mine,
    sui: SAMPLE_WALLETS.sui.mine,
  };

  const samples = [
    { label: "Ví của tôi", value: linked[chain] },
    { label: "Địa chỉ nhái ví của tôi", value: makeLookalike(chain, linked[chain]) },
    { label: "Ví người lạ", value: SAMPLE_WALLETS[chain].stranger },
    { label: "Sai chuỗi", value: SAMPLE_WALLETS[chain === "sol" ? "sui" : "sol"].mine },
  ];

  function clearResult() {
    setResult(null);
    setError(null);
    setFinished(null);
  }

  async function check() {
    if (!to.trim()) {
      setError("Nhập địa chỉ nhận, hoặc bấm một mẫu bên trên.");
      return;
    }
    setLoading(true);
    clearResult();
    try {
      const res = await fetch(apiUrl("/api/withdraw-check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          to: to.trim(),
          linkedWallets: [linked.sol, linked.sui],
          // The connected wallet is the admin wallet that writes blacklist reports
          blacklistSources: publicKey ? [publicKey.toBase58()] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra, thử lại sau.");
        return;
      }
      setResult(data);
    } catch {
      setError("Không gọi được API. Kiểm tra kết nối mạng.");
    } finally {
      setLoading(false);
    }
  }

  const unit = chain.toUpperCase();

  return (
    <div className="w-full space-y-4">
      <div>
        <Label>Rút về chuỗi</Label>
        <div className="flex gap-2">
          {(["sol", "sui"] as Chain[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setChain(c);
                setTo("");
                clearResult();
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                chain === c
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {c === "sol" ? "SOL (Solana)" : "SUI (Sui)"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        <p className="mb-1 font-medium">Ví đã liên kết với tài khoản game</p>
        <p className="break-all font-mono">SOL: {linked.sol}{publicKey ? " (ví Phantom đang kết nối)" : " (ví mẫu)"}</p>
        <p className="break-all font-mono">SUI: {linked.sui} (ví mẫu)</p>
      </div>

      <div>
        <Label>Số tiền</Label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className={inputClass}
        />
      </div>

      <div>
        <Label>Địa chỉ nhận</Label>
        <div className="mb-2 flex flex-wrap gap-2">
          {samples.map((s) => (
            <Chip
              key={s.label}
              label={s.label}
              onClick={() => {
                setTo(s.value);
                clearResult();
              }}
            />
          ))}
        </div>
        <input
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            clearResult();
          }}
          placeholder={chain === "sol" ? "Địa chỉ ví Solana..." : "Địa chỉ ví Sui (0x...)"}
          className={inputClass}
        />
      </div>

      <button onClick={check} disabled={loading} className={primaryButtonClass}>
        {loading ? "Veris đang kiểm tra..." : `Rút ${amount || 0} ${unit}`}
      </button>

      {error && <ErrorBox message={error} />}

      {result && !finished && (
        <Panel tone={result.level === "green" ? "green" : "red"}>
          <p className="font-medium">
            {result.level === "green" ? "🟢 " : "🔴 "}
            {result.title}
          </p>
          {result.reasons.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {result.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {result.action === "withdraw" && (
              <button
                className={primaryButtonClass}
                onClick={() => setFinished(`Đã rút ${amount} ${unit} về ví ${shortenAddress(to)}.`)}
              >
                Ký ví & rút
              </button>
            )}
            {result.action === "warn" && (
              <>
                <button className={primaryButtonClass} onClick={clearResult}>
                  Hủy giao dịch
                </button>
                <button
                  className={secondaryButtonClass}
                  onClick={() =>
                    setFinished(`Bạn đã chọn vẫn rút ${amount} ${unit} tới ${shortenAddress(to)}. Veris chỉ cảnh báo, quyết định là của bạn.`)
                  }
                >
                  Tôi hiểu rủi ro, vẫn rút
                </button>
              </>
            )}
            {result.action === "block" && (
              <button className={secondaryButtonClass} onClick={() => setTo("")}>
                Sửa lại địa chỉ
              </button>
            )}
          </div>
        </Panel>
      )}

      {finished && (
        <Panel tone="neutral">
          <p className="text-sm font-medium">{finished}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Mô phỏng — trong game thật, bước này là lúc game gọi ví ký và chuyển tiền.
          </p>
        </Panel>
      )}
    </div>
  );
}
