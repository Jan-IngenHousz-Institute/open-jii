import type { Config } from "tailwindcss";

import baseConfig from "@repo/tailwind-config/web";

// Colors, fonts and radii are defined in `app/globals.css` (`:root`/`.dark` +
// `@theme inline`). Anything defined here would override those variables, so
// this file carries only the content globs and non-token utilities.
export default {
  // We need to append the path to the UI package to the content array so that
  // those classes are included correctly.
  content: [
    ...baseConfig.content,
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/cms/src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [baseConfig],
  theme: {
    extend: {
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "version-pop": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "60%": { transform: "scale(1.03)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "shortcut-pop": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.92)" },
          "60%": { opacity: "1", transform: "translateY(-3px) scale(1.04)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "version-pop": "version-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "shortcut-pop": "shortcut-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
} satisfies Config;
