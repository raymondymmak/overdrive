/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand: obsidian #090A0F, electric indigo #6366F1, emerald #10B981.
        // `indigo` / `emerald` extend Tailwind's palettes, so indigo-500 etc. still work alongside bg-indigo.
        obsidian: { DEFAULT: "#090A0F", 900: "#0C0E15", 800: "#11141D", 700: "#181C28", 600: "#222737" },
        panel: "#0F1119",
        raised: "#151824",
        line: "#232838",
        ink: { DEFAULT: "#E7E9F2", dim: "#9AA0B4", faint: "#5F6578" },
        indigo: { DEFAULT: "#6366F1", soft: "#A5B4FC", deep: "#4F46E5" },
        emerald: { DEFAULT: "#10B981", soft: "#6EE7B7", deep: "#059669" },
        amber: { DEFAULT: "#F5B544" },
        rose: { DEFAULT: "#F0648C" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "slide-in": { from: { transform: "translateX(24px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        "fade-up": { from: { transform: "translateY(8px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        sweep: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "slide-in": "slide-in .22s ease-out both",
        "fade-up": "fade-up .28s ease-out both",
        sweep: "sweep 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};
