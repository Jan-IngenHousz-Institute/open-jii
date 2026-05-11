// Tailwind config in plain CJS for Metro/EAS compatibility
const nativewind = require("nativewind/preset");
const baseConfig = require("@repo/tailwind-config/native");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [baseConfig, nativewind],
  // The shared base uses `darkMode: ['class']` which NativeWind v4 silently
  // ignores (its dark-mode plugin requires the selector as the array's
  // second item, or a plain string). Override here so `dark:` variants and
  // CSS-var swapping under `.dark:root` actually fire on native.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // JII-specific semantic tokens layered on top of the shared base
        // (background/card/border/foreground/muted/etc. come from baseConfig).
        surface: "hsl(var(--surface))",
        "on-surface": "hsl(var(--on-surface))",
        "on-background": "hsl(var(--on-background))",
        "on-primary": "hsl(var(--on-primary))",
        divider: "hsl(var(--divider))",
        inactive: "hsl(var(--inactive))",
        "gray-background": "hsl(var(--gray-background))",
        "jii-primary": {
          DEFAULT: "hsl(var(--jii-primary))",
          bright: "hsl(var(--jii-primary-bright))",
        },
        "jii-secondary": {
          blue: "hsl(var(--jii-secondary-blue))",
          yellow: "hsl(var(--jii-secondary-yellow))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
        info: "hsl(var(--info))",
      },
    },
  },
};
