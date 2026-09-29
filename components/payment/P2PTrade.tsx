"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import type { PartyCheck, TradeCheckResult } from "@/app/api/trade-check/route";
import { shortenAddress, type Chain } from "@/lib/address";
import { apiUrl } from "@/lib/api";
import { buildReportMemo } from "@/lib/blacklist";
import { writeEvidence } from "@/lib/writeChain";
import { SAMPLE_CHATS, SAMPLE_WALLETS } from "@/lib/paymentSamples";
import {
  applyEvent,
  createTrade,
  isClosed,
  type Role,
  type Trade,
  type TradeEvent,
  type TradeStatus,
} from "@/lib/tempWallet";
import {
  Chip,
  ErrorBox,
  Label,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/payment/ui";

const STATUS_LABEL: Record<TradeStatus, string> = {
  awaiting_deposit: "③ Chờ hai bên cọc",
  deposited: "④ Chờ người mua trả nốt",
  paid: "⑤ Chờ người bán giao hàng",
  completed: "⑥ Hoàn tất — đã giải ngân",
  frozen: "🧊 Đóng băng — chờ admin",
  cancelled: "Đã hủy — đã hoàn / phạt cọc",
};

const LEVEL_TITLE = {
  green: "🟢 Kèo ổn — có thể mở temp wallet",
  yellow: "🟡 Có điểm cần chú ý",
};

function PartySummary({ label, party }: { label: string; party: PartyCheck }) {
  return (
    <div className="rounded-md border border-zinc-200 p-2 text-xs dark:border-zinc-800">
      <p className="font-medium">{label}: <span className="font-mono">{shortenAddress(party.address)}</span></p>
      <p className="text-zinc-500">
        Báo cáo: {party.reportCount}
        {party.txCount !== null && ` · ${party.txCount} giao dịch`}
        {party.isNewWallet && " · ví mới"}
        {party.firstFunder && ` · nạp đầu từ ${shortenAddress(party.firstFunder)}`}
      </p>
      {party.note && <p className="text-zinc-500">{party.note}</p>}
    </div>
  );
}

/** Mode 2 - player-to-player trade through a temp wallet, both sides deposit */
export function P2PTrade() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [chain, setChain] = useState<Chain>("sol");
  const [value, setValue] = useState("100");
  const [buyer, setBuyer] = useState(SAMPLE_WALLETS.sol.buyer);
  const [seller, setSeller] = useState(SAMPLE_WALLETS.sol.seller);
  const [chat, setChat] = useState(SAMPLE_CHATS[0].text);
  const [check, setCheck] = useState<TradeCheckResult | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Side the admin ruled against -> can be written to the on-chain blacklist
  const [wrongSide, setWrongSide] = useState<Role | null>(null);
  const [reportLink, setReportLink] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  const unit = chain.toUpperCase();

  function resetAll() {
    setCheck(null);
    setTrade(null);
    setError(null);
    setWrongSide(null);
    setReportLink(null);
    setReportError(null);
  }

  function switchChain(c: Chain) {
    setChain(c);
    setBuyer(SAMPLE_WALLETS[c].buyer);
    setSeller(SAMPLE_WALLETS[c].seller);
    resetAll();
  }

  async function runCheck() {
    setLoading(true);
    resetAll();
    try {
      const res = await fetch(apiUrl("/api/trade-check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          value: Number(value),
          buyer: buyer.trim(),
          seller: seller.trim(),
          chat,
          blacklistSources: publicKey ? [publicKey.toBase58()] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra, thử lại sau.");
        return;
      }
      setCheck(data);
    } catch {
      setError("Không gọi được API. Kiểm tra kết nối mạng.");
    } finally {
      setLoading(false);
    }
  }

  function openTempWallet() {
    if (!check) return;
    try {
      const t = createTrade({
        id: Date.now().toString(36).toUpperCase(),
        chain,
        value: Number(value),
        buyer: buyer.trim(),
        seller: seller.trim(),
      });
      setTrade(t);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function act(event: TradeEvent) {
    if (!trade) return;
    try {
      setTrade(applyEvent(trade, event));
      setError(null);
      if (event.type === "admin_resolve" && event.outcome !== "refund_both") {
        setWrongSide(event.outcome === "buyer_right" ? "seller" : "buyer");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Feedback loop: write the wallet the admin ruled against into the blacklist on Solana */
  async function reportWrongSide() {
    if (!trade || !wrongSide || !publicKey) return;
    setReporting(true);
    setReportError(null);
    try {
      const target = wrongSide === "buyer" ? trade.buyer : trade.seller;
      const result = await writeEvidence(connection, publicKey, sendTransaction, buildReportMemo(target, "tranh_chap"));
      setReportLink(result.solscanLink);
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setReporting(false);
    }
  }

  const running = trade && !isClosed(trade) && trade.status !== "frozen";

  return (
    <div className="w-full space-y-4">
      {/* ---------- ① Agree the deal ---------- */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Chuỗi</Label>
          <div className="flex gap-2">
            {(["sol", "sui"] as Chain[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => switchChain(c)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  chain === c
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="w-32">
          <Label>Giá trị kèo</Label>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              resetAll();
            }}
            inputMode="decimal"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Ví người mua</Label>
          <input value={buyer} onChange={(e) => { setBuyer(e.target.value); resetAll(); }} className={inputClass} />
        </div>
        <div>
          <Label>Ví người bán</Label>
          <input value={seller} onChange={(e) => { setSeller(e.target.value); resetAll(); }} className={inputClass} />
        </div>
      </div>

      <div>
        <Label>① Chat chốt kèo</Label>
        <div className="mb-2 flex flex-wrap gap-2">
          {SAMPLE_CHATS.map((c) => (
            <Chip
              key={c.label}
              label={c.label}
              onClick={() => {
                setChat(c.text.replaceAll("{STRANGER}", SAMPLE_WALLETS[chain].stranger));
                resetAll();
              }}
            />
          ))}
        </div>
        <textarea
          value={chat}
          onChange={(e) => {
            setChat(e.target.value);
            resetAll();
          }}
          rows={4}
          className={`${inputClass} font-sans`}
        />
      </div>

      <button onClick={runCheck} disabled={loading} className={primaryButtonClass}>
        {loading ? "Veris đang kiểm tra kèo..." : "Chốt kèo — Veris kiểm tra"}
      </button>

      {error && <ErrorBox message={error} />}

      {/* ---------- Veris result ---------- */}
      {check && (
        <Panel tone={check.level}>
          <p className="font-medium">{LEVEL_TITLE[check.level]}</p>
          <p className="mt-1 text-sm">
            Kèo {value} {unit} → mỗi bên cọc {Math.round(check.depositRate * 100)}% ={" "}
            <b>{check.deposit} {unit}</b>
          </p>

          {check.reasons.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {check.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <PartySummary label="Người mua" party={check.buyer} />
            <PartySummary label="Người bán" party={check.seller} />
          </div>

          {!trade && (
            <button onClick={openTempWallet} className={`${primaryButtonClass} mt-3`}>
              {check.recommendation === "warn"
                ? "② Đã đọc cảnh báo — vẫn mở temp wallet"
                : "② Mở temp wallet cho kèo"}
            </button>
          )}
        </Panel>
      )}

      {/* ---------- ②-⑥ Temp wallet board ---------- */}
      {trade && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="font-medium">🧑 Người mua</p>
              <p className="font-mono text-xs text-zinc-500">{shortenAddress(trade.buyer)}</p>
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-2 dark:bg-amber-950/30">
              <p className="font-medium">🔐 Temp wallet</p>
              <p className="font-mono text-xs text-zinc-500">TEMP-{trade.id} (mô phỏng)</p>
              <p className="mt-1 text-lg font-semibold">
                {trade.balance} {unit}
              </p>
              <p className="text-xs">{STATUS_LABEL[trade.status]}</p>
            </div>
            <div>
              <p className="font-medium">🧑 Người bán</p>
              <p className="font-mono text-xs text-zinc-500">{shortenAddress(trade.seller)}</p>
            </div>

            {/* Buyer actions */}
            <div className="flex flex-col gap-2">
              {trade.status === "awaiting_deposit" && (
                <button
                  className={secondaryButtonClass}
                  disabled={trade.deposited.buyer}
                  onClick={() => act({ type: "deposit", role: "buyer" })}
                >
                  {trade.deposited.buyer ? "✓ Đã cọc" : `Cọc ${trade.deposit}`}
                </button>
              )}
              {trade.status === "deposited" && (
                <button className={secondaryButtonClass} onClick={() => act({ type: "pay_remainder" })}>
                  Trả nốt {Math.round((trade.value - trade.deposit) * 1e9) / 1e9}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {running && (
                <>
                  <button className={secondaryButtonClass} onClick={() => act({ type: "timeout" })}>
                    ⏱ Quá hạn (một bên bùng)
                  </button>
                  <button
                    className={secondaryButtonClass}
                    onClick={() => act({ type: "freeze", by: "veris", reason: "người chơi báo tranh chấp" })}
                  >
                    ⚠ Báo tranh chấp
                  </button>
                </>
              )}
            </div>
            {/* Seller actions */}
            <div className="flex flex-col gap-2">
              {trade.status === "awaiting_deposit" && (
                <button
                  className={secondaryButtonClass}
                  disabled={trade.deposited.seller}
                  onClick={() => act({ type: "deposit", role: "seller" })}
                >
                  {trade.deposited.seller ? "✓ Đã cọc" : `Cọc ${trade.deposit}`}
                </button>
              )}
              {trade.status === "paid" && (
                <button className={secondaryButtonClass} onClick={() => act({ type: "deliver" })}>
                  Giao hàng (game xác nhận)
                </button>
              )}
            </div>
          </div>

          {trade.status === "frozen" && (
            <Panel tone="red">
              <p className="text-sm font-medium">🧊 Đóng băng: {trade.freezeReason}</p>
              <p className="mt-1 text-xs">
                Tiền nằm yên trong temp wallet. Veris không tự chuyển tiền — admin xem bằng chứng và quyết định:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={secondaryButtonClass} onClick={() => act({ type: "admin_resolve", outcome: "buyer_right" })}>
                  Admin: người mua đúng
                </button>
                <button className={secondaryButtonClass} onClick={() => act({ type: "admin_resolve", outcome: "seller_right" })}>
                  Admin: người bán đúng
                </button>
                <button className={secondaryButtonClass} onClick={() => act({ type: "admin_resolve", outcome: "refund_both" })}>
                  Admin: hoàn cả hai
                </button>
                <button className={secondaryButtonClass} onClick={() => act({ type: "unfreeze" })}>
                  Admin: mở băng, tiếp tục
                </button>
              </div>
            </Panel>
          )}

          {isClosed(trade) && (
            <Panel tone={trade.status === "completed" ? "green" : "neutral"}>
              <p className="text-sm font-medium">Giải ngân (chỉ về 2 ví của kèo):</p>
              {trade.payouts.length === 0 ? (
                <p className="text-sm">Không có tiền trong temp wallet.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {trade.payouts.map((p, i) => (
                    <li key={i}>
                      → {p.role === "buyer" ? "Người mua" : "Người bán"}{" "}
                      <span className="font-mono text-xs">{shortenAddress(p.to)}</span>:{" "}
                      <b>{p.amount} {unit}</b> — {p.reason}
                    </li>
                  ))}
                </ul>
              )}
              {wrongSide && (
                <div className="mt-3 rounded-md border border-current/20 p-3 text-sm">
                  <p className="font-medium">
                    🔁 Ghi ví {wrongSide === "buyer" ? "người mua" : "người bán"} vào sổ đen
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    Admin đã phân xử bên này sai. Ghi lên Solana để lần sau Veris cảnh báo người khác —
                    ký bằng ví admin (ví Phantom đang kết nối), ví này cũng là nguồn sổ đen.
                  </p>
                  {reportLink ? (
                    <a href={reportLink} target="_blank" rel="noreferrer" className="mt-2 block underline">
                      ✅ Đã ghi — xem trên Solscan
                    </a>
                  ) : publicKey ? (
                    <button onClick={reportWrongSide} disabled={reporting} className={`${primaryButtonClass} mt-2`}>
                      {reporting ? "Đang ghi lên chain..." : "Ghi vào sổ đen"}
                    </button>
                  ) : (
                    <p className="mt-2 text-xs">Kết nối ví admin (Phantom) ở đầu trang để ghi.</p>
                  )}
                  {reportError && <p className="mt-2 text-xs text-red-700 dark:text-red-300">Lỗi: {reportError}</p>}
                </div>
              )}
              <button className={`${secondaryButtonClass} mt-3`} onClick={resetAll}>
                Làm kèo mới
              </button>
            </Panel>
          )}

          <div className="mt-4">
            <Label>Nhật ký temp wallet</Label>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
              {trade.log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
