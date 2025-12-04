import type { Config } from "tailwindcss";

import baseConfig from "@repo/tailwind-config/web";

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
      colors: {
        // JII Brand Colors
        "jii-dark-green": "#005e5e", // Same as primary
        "jii-bright-green": "#49e06d", // Same as secondary
        "jii-medium-green": "#76b465", // Same as tertiary
        "jii-light-blue": "#afd7f4", // Same as accent
        "jii-light-yellow": "#fff381", // Same as highlight
        // System colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#005e5e", // Dark teal
          light: "#007575",
          dark: "#005151",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "#49e06d", // Bright green
          foreground: "hsl(var(--secondary-foreground))",
        },
        tertiary: {
          DEFAULT: "#76b465", // Medium green
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#afd7f4", // Light blue
          light: "#d7ebfa", // Lighter blue (50%)
          foreground: "#000000",
        },
        // Light surface color for panels/cards (used for login containers etc.)
        surface: {
          DEFAULT: "#EDF2F6",
          dark: "#E7EDF2",
          light: "#F6F8FA",
          foreground: "#000000",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          background: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
        },
        badge: {
          DEFAULT: "#FBF8C1",
          provisioning: "#FFF3B0",
          provisioningFailed: "#FFE0E0",
          active: "#CCFCD8",
          stale: "#FFE0B2",
          archived: "#E7EDF2",
          published: "#D8F2FC",
          featured: "#E2FCFC",
        },
        highlight: {
          DEFAULT: "#fff381", // Yellow
          light: "#fff9c0", // Lighter yellow (50%)
          foreground: "#000000",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        overpass: ["Overpass", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        notosans: ["Noto Sans", "sans-serif"],
      },
    },
  },
} satisfies Config;
