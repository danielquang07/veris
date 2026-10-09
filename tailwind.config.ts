import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#18181B", elevated: "#27272A" },
        accent: { DEFAULT: "#3B82F6", hover: "#60A5FA" },
        danger: { DEFAULT: "#EF4444", hover: "#F87171" },
        warning: { DEFAULT: "#F59E0B" },
        safe: { DEFAULT: "#10B981" },
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "scale-in": "scaleIn 200ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
