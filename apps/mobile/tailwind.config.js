/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.ts'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {}
  },
  plugins: []
}
