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
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#005e5e", // Dark teal
          light: "#007575",
          dark: "#005151",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "#49e06d", // Bright green
          foreground: "var(--secondary-foreground)",
        },
        tertiary: {
          DEFAULT: "#76b465", // Medium green
          foreground: "#ffffff",
        },
        quaternary: {
          DEFAULT: "#E2FCFC", // Light green
          light: "#EDFFFF",
          dark: "#DAF9F9",
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
          DEFAULT: "var(--sidebar-background)",
          background: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          "gradient-from": "#002F2F",
          "gradient-to": "#005E5E",
          "search-icon": "#638A8A",
          "search-placeholder": "#729999",
          "active-bg": "#1A4444",
          "trigger-hover": "#007070",
          "mobile-bg": "#002F2F",
        },
        badge: {
          DEFAULT: "#FBF8C1",

          active: "#CCFCD8",
          stale: "#FFE0B2",
          archived: "#E7EDF2",
          published: "#D8F2FC",
          featured: "#E2FCFC",
        },
        highlight: {
          DEFAULT: "#FFF481", // Yellow
          light: "#FBF8C1",
          dark: "#FFEF4B",
          foreground: "#000000",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
          dark: "#011111",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        checkbox: {
          DEFAULT: "#09B732",
          foreground: "#ffffff",
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
        ellipsis: {
          "0%": { content: '""' },
          "25%": { content: '"."' },
          "50%": { content: '".."' },
          "75%": { content: '"..."' },
          "100%": { content: '""' },
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
