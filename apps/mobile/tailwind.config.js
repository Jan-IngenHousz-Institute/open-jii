// Tailwind config in plain CJS for Metro/EAS compatibility
const nativewind = require("nativewind/preset");
const baseConfig = require("@repo/tailwind-config/native");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [baseConfig, nativewind],
};

