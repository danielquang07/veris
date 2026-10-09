import React from "react";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "safe" | "warning" | "danger" | "neutral";
};

export function Badge({ variant = "neutral", className, ...props }: Props) {
  const v = {
    safe: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60",
    warning: "bg-amber-950/60 text-amber-400 border border-amber-800/60",
    danger: "bg-red-950/60 text-red-400 border border-red-800/60",
    neutral: "bg-zinc-800 text-zinc-300 border border-zinc-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${v[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
