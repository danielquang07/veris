import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...props }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const v = {
    primary: "bg-accent hover:bg-accent-hover text-white",
    secondary: "border border-zinc-700 hover:bg-zinc-800 text-zinc-100",
    danger: "bg-danger hover:bg-danger-hover text-white",
    ghost: "hover:bg-zinc-800 text-zinc-300",
  };
  const s = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return <button className={`${base} ${v[variant]} ${s[size]} ${className ?? ""}`} {...props} />;
}
