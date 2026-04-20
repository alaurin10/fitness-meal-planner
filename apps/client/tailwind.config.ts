import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        paper: "var(--paper)",
        clay: "var(--clay)",
        ink: "var(--ink)",
        sumi: "var(--sumi)",
        muted: "var(--muted)",
        hair: "var(--hair)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        moss: "var(--moss)",
        rose: "var(--rose)",
        honey: "var(--honey)",
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(90, 60, 30, 0.04), 0 2px 6px rgba(90, 60, 30, 0.035)",
        md: "0 2px 8px rgba(90, 60, 30, 0.06), 0 8px 24px rgba(90, 60, 30, 0.05)",
        lg: "0 4px 16px rgba(90, 60, 30, 0.09), 0 20px 60px rgba(90, 60, 30, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
