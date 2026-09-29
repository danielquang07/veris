"use client";

import { useEffect, useState } from "react";
import { CHAIN_NAME, guessChain, isValidAddress, type Chain } from "@/lib/address";
import { ErrorBox, Label, Panel, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/payment/ui";

type Direction = { from: Chain; to: Chain };

const STEPS = (d: Direction, amount: string) => [
  {
    title: `Khóa ${amount} ${d.from.toUpperCase()} trên ${CHAIN_NAME[d.from]}`,
    detail: `Tiền được gửi vào két của cầu nối trên ${CHAIN_NAME[d.from]} — không ai rút được nếu chưa có bằng chứng từ chain kia.`,
  },
  {
    title: "Relayer / guardian xác nhận",
    detail: "Nhóm xác thực đọc giao dịch khóa, đủ chữ ký (ví dụ 13/19) mới phát hành bằng chứng (VAA).",
  },
  {
    title: `Đúc ${amount} w${d.from.toUpperCase()} trên ${CHAIN_NAME[d.to]}`,
    detail: `Hợp đồng bên ${CHAIN_NAME[d.to]} kiểm tra bằng chứng rồi đúc token bọc (wrapped) 1:1 về ví nhận.`,
  },
  {
    title: "Chiều về: đốt → mở khóa",
    detail: `Muốn quay lại ${CHAIN_NAME[d.from]}: đốt token bọc bên ${CHAIN_NAME[d.to]}, relayer xác nhận, két mở khóa tiền gốc.`,
  },
];

/**
 * Cross-chain bridge, SIMULATED: explains lock & mint step by step. The real part is the
 * destination check - a Solana address pasted for a Sui transfer (or the reverse) is blocked,
 * the most common way players lose funds when bridging.
 */
export function CrossChainDemo() {
  const [dir, setDir] = useState<Direction>({ from: "sol", to: "sui" });
  const [amount, setAmount] = useState("1");
  const [to, setTo] = useState("");
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const steps = STEPS(dir, amount);

  useEffect(() => {
    if (step < 0 || step >= steps.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [step, steps.length]);

  function start() {
    setError(null);
    const dest = to.trim();
    if (!(Number(amount.replace(",", ".")) > 0)) return setError("Nhập số lượng lớn hơn 0.");
    if (!isValidAddress(dir.to, dest)) {
      const actual = guessChain(dest);
      return setError(
        actual
          ? `Đây là địa chỉ ${CHAIN_NAME[actual]}, nhưng tiền sẽ tới ${CHAIN_NAME[dir.to]}. Gửi sai chain là mất tiền — đã chặn.`
          : `Địa chỉ nhận không hợp lệ trên ${CHAIN_NAME[dir.to]}.`
      );
    }
    setStep(0);
  }

  return (
    <div className="w-full space-y-4">
      <Panel tone="yellow">
        <p className="text-sm font-medium">Bản mô phỏng — chưa gửi giao dịch lên chain.</p>
        <p className="mt-1 text-xs">
          Cầu nối thật cần hạ tầng xác thực riêng (ví dụ Wormhole). Phần chạy thật ở đây là kiểm tra địa chỉ nhận đúng chain.
        </p>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border px-4 py-2 text-sm font-medium">{CHAIN_NAME[dir.from]}</span>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setDir({ from: dir.to, to: dir.from });
            setStep(-1);
            setTo("");
          }}
        >
          ⇄
        </button>
        <span className="rounded-lg border px-4 py-2 text-sm font-medium">{CHAIN_NAME[dir.to]}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Số lượng ({dir.from.toUpperCase()})</Label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <Label>Ví nhận trên {CHAIN_NAME[dir.to]}</Label>
          <input
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setStep(-1);
            }}
            placeholder={dir.to === "sui" ? "0x... (64 ký tự hex)" : "Địa chỉ ví Solana..."}
            className={inputClass}
          />
        </div>
      </div>

      <button onClick={start} className={primaryButtonClass}>
        Mô phỏng chuyển qua cầu nối
      </button>
      {error && <ErrorBox message={error} />}

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`rounded-lg border p-3 text-sm transition ${
              i <= step
                ? "border-green-600/40 bg-green-50 dark:bg-green-950/30"
                : "border-zinc-200 opacity-60 dark:border-zinc-800"
            }`}
          >
            <p className="font-medium">
              {i <= step ? "✓" : `${i + 1}.`} {s.title}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{s.detail}</p>
          </li>
        ))}
      </ol>

      <Panel tone="neutral">
        <p className="text-sm font-medium">Lộ trình làm thật</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          <li>Tích hợp Wormhole Token Bridge (Solana ↔ Sui) cho SOL và token game.</li>
          <li>Hiện trạng thái chuyển theo thời gian thực bằng mã giao dịch hai đầu.</li>
          <li>Giới hạn số tiền mỗi lần và cảnh báo phí cầu nối trước khi ký.</li>
        </ul>
      </Panel>
    </div>
  );
}
