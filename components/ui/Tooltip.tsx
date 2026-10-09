import React from "react";

type Props = {
  content: string;
  children: React.ReactNode;
  className?: string;
};

export function Tooltip({ content, children, className }: Props) {
  return (
    <div className={`relative inline-block group ${className ?? ""}`}>
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block group-focus:block z-50 whitespace-nowrap rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-200 shadow-lg pointer-events-none">
        {content}
      </div>
    </div>
  );
}
