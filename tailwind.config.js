/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
      colors: {
        brand: {
          red: '#E8272A',
          dark: '#0F0F0F',
          charcoal: '#1A1A1A',
          surface: '#242424',
          border: '#2E2E2E',
          muted: '#6B6B6B',
          text: '#E8E8E8',
          dim: '#A0A0A0',
        }
      }
    },
  },
  plugins: [],
}
