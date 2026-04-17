import type { Config } from "tailwindcss";

import base from "./base";

export default {
  darkMode: "class",
  content: base.content,
  presets: [base],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      colors: {
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          accent: "var(--sidebar-accent)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
        },
      },
    },
  },
} satisfies Config;
