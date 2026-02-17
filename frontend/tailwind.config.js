/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bloomberg Terminal / Linear inspired palette
        'bg-primary': '#0a0a0f',
        'bg-secondary': '#12121a',
        'bg-card': '#1a1a24',
        'bg-hover': '#24242f',
        'border': '#2a2a36',
        'text-primary': '#f0f0f5',
        'text-secondary': '#8888a0',
        'text-muted': '#5a5a70',
        'accent-blue': '#3b82f6',
        'accent-green': '#22c55e',
        'accent-yellow': '#eab308',
        'accent-red': '#ef4444',
        'accent-purple': '#a855f7',
        'accent-orange': '#f97316',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
