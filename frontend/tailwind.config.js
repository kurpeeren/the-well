/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f172a',
        'kuyu-dark': '#020617',
        'blood-red': '#7f1d1d',
        'accent': '#1d4ed8'
      }
    },
  },
  plugins: [],
}
