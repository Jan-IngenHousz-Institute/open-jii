// Tailwind v4 reads its theme/colors from global.css (@theme).
// Only the content globs live here, for Metro/EAS compatibility.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./index.tsx"],
};
