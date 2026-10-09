import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: Props) {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${className ?? ""}`}
      {...props}
    />
  );
}
