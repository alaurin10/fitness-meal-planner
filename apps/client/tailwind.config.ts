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
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      // Derived from --radius so palette-level radius changes apply everywhere.
      borderRadius: {
        sm: "calc(var(--radius) * 0.5)",
        md: "calc(var(--radius) * 0.7)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) * 1.4)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
} satisfies Config;
