import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf4ed',
          100: '#fbe5d0',
          200: '#f7c89d',
          300: '#f2a465',
          400: '#ed8033',
          500: '#e86010',  // primary — warm orange (painting)
          600: '#d4510d',
          700: '#b0400c',
          800: '#8d3410',
          900: '#722d12',
          950: '#3d1508',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
