"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import type { TradeCheckResult } from "@/app/api/trade-check/route";
import { shortenAddress } from "@/lib/address";
import { apiUrl } from "@/lib/api";
import {
  LAMPORTS_PER_SOL,
  explainError,
  fetchConfigAdmin,
  fetchTrade,
  formatSol,
  marketIx,
  sendMarketIx,
  tradePda,
  type OnChainStatus,
  type OnChainTrade,
} from "@/lib/market";
import {
  ErrorBox,
  Label,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/payment/ui";
import type { TransactionInstruction } from "@solana/web3.js";

const STATUS_LABEL: Record<OnChainStatus, string> = {
  awaiting_deposit: "① Chờ hai bên cọc",
  deposited: "② Chờ người mua trả nốt",
  paid: "③ Chờ xác nhận giao hàng",
  completed: "✅ Hoàn tất — đã giải ngân cho người bán",
  frozen: "🧊 Đóng băng — chờ admin phân xử",
  cancelled: "Đã hủy — tiền đã hoàn / phạt cọc",
};

type TxLog = { label: string; link: string };

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function parseKey(s: string): PublicKey | null {
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
}

/** Mode 3 - player-to-player item trade enforced by the veris_market escrow program on Solana devnet */
export function EscrowTrade() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const now = useNow();

  const [seller, setSeller] = useState("");
  const [valueSol, setValueSol] = useState("0.1");
  const [item, setItem] = useState("Thanh Long Đao +7");
  const [stageMin, setStageMin] = useState("10");
  const [check, setCheck] = useState<TradeCheckResult | null>(null);

  const [tradeInput, setTradeInput] = useState("");
  const [tradeAddress, setTradeAddress] = useState<PublicKey | null>(null);
  const [trade, setTrade] = useState<OnChainTrade | null>(null);
  const [admin, setAdmin] = useState<PublicKey | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TxLog[]>([]);

  // Open a trade shared by link: ?trade=<address>
  useEffect(() => {
    const t = setTimeout(() => {
      const fromUrl = new URLSearchParams(window.location.search).get("trade");
      const key = fromUrl ? parseKey(fromUrl) : null;
      if (key) {
        setTradeInput(key.toBase58());
        setTradeAddress(key);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!tradeAddress) return;
    try {
      const [t, a] = await Promise.all([fetchTrade(connection, tradeAddress), fetchConfigAdmin(connection)]);
      setTrade(t);
      setAdmin(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [connection, tradeAddress]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  async function run(label: string, build: () => TransactionInstruction, after?: () => void) {
    if (!publicKey) return setError("Kết nối ví Phantom (devnet) trước.");
    setBusy(label);
    setError(null);
    try {
      const res = await sendMarketIx(connection, publicKey, sendTransaction, build());
      setLogs((l) => [{ label, link: res.solscanLink }, ...l]);
      after?.();
      await refresh();
    } catch (e) {
      setError(explainError((e as Error).message ?? String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function runCheck() {
    setError(null);
    setCheck(null);
    if (!publicKey) return setError("Kết nối ví Phantom (devnet) trước — ví đang kết nối là người mua.");
    const sellerKey = parseKey(seller);
    if (!sellerKey) return setError("Ví người bán không hợp lệ.");
    setBusy("check");
    try {
      const res = await fetch(apiUrl("/api/trade-check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: "sol",
          value: Number(valueSol),
          buyer: publicKey.toBase58(),
          seller: sellerKey.toBase58(),
          blacklistSources: admin ? [admin.toBase58()] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Không kiểm tra được kèo.");
      else setCheck(data);
    } catch {
      setError("Không gọi được API kiểm tra. Kiểm tra kết nối mạng.");
    } finally {
      setBusy(null);
    }
  }

  function createTrade() {
    const sellerKey = parseKey(seller);
    const value = BigInt(Math.round(Number(valueSol) * LAMPORTS_PER_SOL));
    if (!publicKey || !sellerKey || value <= BigInt(0)) return;
    const tradeId = BigInt(Date.now());
    const address = tradePda(publicKey, tradeId);
    const stageSecs = BigInt(Math.max(1, Math.round(Number(stageMin) * 60)));
    run("Tạo kèo", () => marketIx.createTrade(publicKey, sellerKey, tradeId, value, item.trim(), stageSecs), () => {
      setTradeAddress(address);
      setTradeInput(address.toBase58());
      setCheck(null);
    });
  }

  const me = publicKey?.toBase58();
  const isBuyer = !!trade && me === trade.buyer.toBase58();
  const isSeller = !!trade && me === trade.seller.toBase58();
  const isAdmin = !!admin && me === admin.toBase58();
  const expired = !!trade && BigInt(now) > trade.deadline;
  const open = !!trade && ["awaiting_deposit", "deposited", "paid"].includes(trade.status);
  const secondsLeft = trade ? Number(trade.deadline) - now : 0;
  const shareLink =
    tradeAddress && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?trade=${tradeAddress.toBase58()}`
      : "";

  return (
    <div className="w-full space-y-4">
      <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Tiền cọc và tiền hàng nằm trong smart contract <b>veris_market</b> trên Solana devnet, không nằm ở ví ai cả.
        Hợp đồng chỉ cho phép trả tiền về đúng 2 ví của kèo. Ví đang kết nối:{" "}
        <span className="font-mono">{me ? shortenAddress(me) : "chưa kết nối"}</span>
        {isAdmin && " (admin chợ)"}
      </p>

      {/* ---------- Create ---------- */}
      {!trade && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ví người bán (Solana)</Label>
              <input value={seller} onChange={(e) => setSeller(e.target.value)} className={inputClass} placeholder="Địa chỉ ví người bán..." />
            </div>
            <div>
              <Label>Vật phẩm</Label>
              <input value={item} maxLength={40} onChange={(e) => setItem(e.target.value)} className={`${inputClass} font-sans`} />
            </div>
            <div>
              <Label>Giá (SOL devnet)</Label>
              <input value={valueSol} onChange={(e) => setValueSol(e.target.value)} inputMode="decimal" className={inputClass} />
            </div>
            <div>
              <Label>Thời hạn mỗi bước (phút)</Label>
              <input value={stageMin} onChange={(e) => setStageMin(e.target.value)} inputMode="numeric" className={inputClass} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={runCheck} disabled={!!busy} className={secondaryButtonClass}>
              {busy === "check" ? "Đang kiểm tra..." : "Kiểm tra ví hai bên"}
            </button>
            <button onClick={createTrade} disabled={!!busy || !publicKey} className={primaryButtonClass}>
              {busy === "Tạo kèo" ? "Đang ký..." : "Tạo kèo on-chain (bạn là người mua)"}
            </button>
          </div>
          {check && (
            <Panel tone={check.level}>
              <p className="font-medium">
                {check.level === "green" ? "🟢 Chưa thấy dấu hiệu bất thường" : "🟡 Có điểm cần chú ý"} — cọc{" "}
                {Math.round(check.depositRate * 100)}% = {check.deposit} SOL mỗi bên
              </p>
              {check.reasons.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {check.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="min-w-0 flex-1">
              <Label>Hoặc mở kèo có sẵn (người bán dán địa chỉ kèo)</Label>
              <input value={tradeInput} onChange={(e) => setTradeInput(e.target.value)} className={inputClass} placeholder="Địa chỉ kèo..." />
            </div>
            <button
              className={secondaryButtonClass}
              onClick={() => {
                const k = parseKey(tradeInput);
                if (k) setTradeAddress(k);
                else setError("Địa chỉ kèo không hợp lệ.");
              }}
            >
              Mở kèo
            </button>
          </div>
        </div>
      )}

      {tradeAddress && !trade && !busy && (
        <p className="text-sm text-zinc-500">Đang tải kèo {shortenAddress(tradeAddress.toBase58())}...</p>
      )}

      {/* ---------- Trade board ---------- */}
      {trade && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {trade.item} — {formatSol(trade.value)} SOL
            </p>
            <a
              className="font-mono text-xs underline"
              href={`https://solscan.io/account/${trade.address.toBase58()}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              kèo {shortenAddress(trade.address.toBase58())}
            </a>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="font-medium">🧑 Người mua{isBuyer && " (bạn)"}</p>
              <p className="font-mono text-xs text-zinc-500">{shortenAddress(trade.buyer.toBase58())}</p>
              <p className="text-xs">{trade.buyerDeposited ? "✓ đã cọc" : "chưa cọc"}{trade.remainderPaid && " · ✓ đã trả nốt"}</p>
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-2 dark:bg-amber-950/30">
              <p className="font-medium">🔐 Escrow on-chain</p>
              <p className="mt-1 text-lg font-semibold">{formatSol(trade.balance)} SOL</p>
              <p className="text-xs">{STATUS_LABEL[trade.status]}</p>
              {open && (
                <p className="text-xs text-zinc-500">
                  {expired ? "Đã quá hạn bước này" : `Còn ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
                </p>
              )}
            </div>
            <div>
              <p className="font-medium">🧑 Người bán{isSeller && " (bạn)"}</p>
              <p className="font-mono text-xs text-zinc-500">{shortenAddress(trade.seller.toBase58())}</p>
              <p className="text-xs">{trade.sellerDeposited ? "✓ đã cọc" : "chưa cọc"}</p>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">Mỗi bên cọc {formatSol(trade.deposit)} SOL</p>

          {/* Actions for the connected wallet */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {trade.status === "awaiting_deposit" && !expired && ((isBuyer && !trade.buyerDeposited) || (isSeller && !trade.sellerDeposited)) && (
              <button className={primaryButtonClass} disabled={!!busy} onClick={() => run("Cọc", () => marketIx.deposit(publicKey!, trade.address))}>
                Cọc {formatSol(trade.deposit)} SOL
              </button>
            )}
            {trade.status === "deposited" && isBuyer && !expired && (
              <button className={primaryButtonClass} disabled={!!busy} onClick={() => run("Trả nốt", () => marketIx.payRemainder(publicKey!, trade.address))}>
                Trả nốt {formatSol(trade.value - trade.deposit)} SOL vào escrow
              </button>
            )}
            {trade.status === "paid" && (isBuyer || isAdmin) && (
              <button className={primaryButtonClass} disabled={!!busy} onClick={() => run("Xác nhận đã nhận hàng", () => marketIx.confirmDelivery(publicKey!, trade))}>
                {isBuyer ? "Đã nhận vật phẩm — giải ngân cho người bán" : "Admin: game xác nhận đã giao"}
              </button>
            )}
            {open && (isBuyer || isSeller) && (
              <button className={secondaryButtonClass} disabled={!!busy} onClick={() => run("Báo tranh chấp", () => marketIx.openDispute(publicKey!, trade.address))}>
                ⚠ Báo tranh chấp (đóng băng)
              </button>
            )}
            {open && expired && publicKey && (
              <button className={secondaryButtonClass} disabled={!!busy} onClick={() => run("Xử lý quá hạn", () => marketIx.claimTimeout(publicKey, trade))}>
                ⏱ Xử lý quá hạn (bên bùng mất cọc)
              </button>
            )}
            {(trade.status === "completed" || trade.status === "cancelled") && isBuyer && (
              <button
                className={secondaryButtonClass}
                disabled={!!busy}
                onClick={() =>
                  run("Đóng kèo", () => marketIx.closeTrade(publicKey!, trade.address), () => {
                    setTrade(null);
                    setTradeAddress(null);
                  })
                }
              >
                Đóng kèo, lấy lại phí thuê tài khoản
              </button>
            )}
          </div>

          {trade.status === "frozen" && (
            <Panel tone="red">
              <p className="text-sm font-medium">🧊 Tiền nằm yên trong escrow, chỉ admin chợ phân xử được.</p>
              {isAdmin ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={secondaryButtonClass} disabled={!!busy} onClick={() => run("Admin: người mua đúng", () => marketIx.resolveDispute(publicKey!, trade, "buyer_right"))}>
                    Người mua đúng
                  </button>
                  <button className={secondaryButtonClass} disabled={!!busy} onClick={() => run("Admin: người bán đúng", () => marketIx.resolveDispute(publicKey!, trade, "seller_right"))}>
                    Người bán đúng
                  </button>
                  <button className={secondaryButtonClass} disabled={!!busy} onClick={() => run("Admin: hoàn cả hai", () => marketIx.resolveDispute(publicKey!, trade, "refund_both"))}>
                    Hoàn cả hai
                  </button>
                  <button className={secondaryButtonClass} disabled={!!busy} onClick={() => run("Admin: mở băng", () => marketIx.unfreeze(publicKey!, trade))}>
                    Mở băng, tiếp tục
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs">Admin chợ: {admin ? shortenAddress(admin.toBase58()) : "chưa khởi tạo"}</p>
              )}
            </Panel>
          )}

          {shareLink && open && (
            <p className="mt-4 break-all text-xs text-zinc-500">
              Gửi link này cho bên kia: <span className="font-mono">{shareLink}</span>
            </p>
          )}

          <button
            className={`${secondaryButtonClass} mt-3`}
            onClick={() => {
              setTrade(null);
              setTradeAddress(null);
              setTradeInput("");
              window.history.replaceState(null, "", window.location.pathname);
            }}
          >
            ← Kèo khác
          </button>
        </div>
      )}

      {busy && busy !== "check" && <p className="text-sm text-zinc-500">⏳ {busy}: chờ ký ví và xác nhận trên Solana...</p>}
      {error && <ErrorBox message={error} />}

      {logs.length > 0 && (
        <div>
          <Label>Giao dịch đã ký</Label>
          <ul className="space-y-1 text-xs">
            {logs.map((l, i) => (
              <li key={i}>
                ✓ {l.label} —{" "}
                <a className="underline" href={l.link} target="_blank" rel="noreferrer">
                  xem trên Solscan
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
