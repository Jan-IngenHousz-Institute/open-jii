import type { Config } from "tailwindcss";

// No colors, fonts or radii here — the consuming app defines those in its
// stylesheet (`@theme inline`), and a value here would silently win over it.
export default {
  darkMode: "class",
  content: ["src/**/*.{ts,tsx}"],
  theme: {},
} satisfies Config;
