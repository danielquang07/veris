import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: Props) {
  return (
    <div
      className={`animate-pulse bg-zinc-800 rounded ${className ?? ""}`}
      {...props}
    />
  );
}
