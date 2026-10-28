/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#090909', panel: '#151515', elevated: '#1D1D1D', silver: '#D0D4DA' }, fontFamily: { sans: ['Inter', 'sans-serif'] } } },
  plugins: []
}