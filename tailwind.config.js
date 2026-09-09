/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2edff',
          100: '#e4d9ff',
          200: '#c9b3ff',
          300: '#a884fb',
          400: '#8a5cf2',
          500: '#6d3be6',
          600: '#5b2ee5',
          700: '#4a25c0',
          800: '#3b1f99',
          900: '#2c1770',
        },
        gold: {
          50: '#fdf6e6',
          100: '#f8e6bd',
          300: '#e9c46a',
          400: '#e0a92e',
          500: '#d1982a',
          600: '#b47f1f',
        },
        rose: {
          400: '#f0507a',
          500: '#e23a5e',
          600: '#d21f4c',
        },
        ink: {
          900: '#161616',
          700: '#3a3a3e',
          500: '#6b6b70',
          400: '#8a8a8e',
          300: '#a9a9ad',
        },
        canvas: '#f6f6f7',
        night: {
          900: '#150c28',
          800: '#1e1338',
          700: '#2a1b4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(20,16,40,0.06), 0 1px 2px rgba(20,16,40,0.04)',
        pop: '0 12px 40px rgba(20,16,40,0.16)',
        frame: '0 40px 90px -20px rgba(30,19,56,0.55)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'slide-up': { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        'sheet-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'pulse-ring': { '0%': { transform: 'scale(0.8)', opacity: 0.7 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
        spinslow: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease both',
        'slide-up': 'slide-up .3s ease both',
        'sheet-up': 'sheet-up .32s cubic-bezier(.22,1,.36,1) both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        spinslow: 'spinslow 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
