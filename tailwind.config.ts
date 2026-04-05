import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      colors: {
        wolf: {
          orange: "#E86A2A",
          "orange-light": "#ff7b3a",
          "orange-dark": "#c85a22",
          bg: "#0a0a0a",
          surface: "#111111",
          card: "#161616",
          border: "rgba(255,255,255,0.06)",
          text: "#e8eaf0",
          muted: "rgba(232,230,227,0.55)",
          faint: "rgba(232,230,227,0.35)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
