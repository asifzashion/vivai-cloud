import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        bg: "#08080f", surface: "#111118", surface2: "#17171f",
        accent: "#7c3aed", accent2: "#a855f7", accent3: "#c084fc",
        pink: "#ec4899", cyan: "#06b6d4", muted: "#6b7280",
      },
      animation: {
        "drift-a": "driftA 14s ease-in-out infinite alternate",
        "drift-b": "driftB 18s ease-in-out infinite alternate",
        "drift-c": "driftC 11s ease-in-out infinite alternate",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        driftA: { from: { transform: "translate(0,0) scale(1)" },     to: { transform: "translate(50px,30px) scale(1.1)" } },
        driftB: { from: { transform: "translate(0,0) scale(1.05)" },  to: { transform: "translate(-40px,20px) scale(0.95)" } },
        driftC: { from: { transform: "translate(0,0) scale(0.9)" },   to: { transform: "translate(20px,-30px) scale(1.1)" } },
      },
    },
  },
  plugins: [],
};
export default config;
