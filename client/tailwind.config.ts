import type { Config } from 'tailwindcss';

/**
 * ASU Sun Devils palette + supporting tokens.
 *
 * Maroon (#8C1D40) and gold (#FFC627) are the official ASU colors. The dark
 * surfaces (ink) ground the broadcast-y "Stadium" aesthetic.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#FFE4ED',
          100: '#FBC2D2',
          200: '#F0879F',
          300: '#DC4F73',
          400: '#B82F58',
          500: '#8C1D40', // Official ASU Maroon
          600: '#771634',
          700: '#5C0E2A',
          800: '#430920',
          900: '#2C0515',
        },
        gold: {
          50: '#FFF8E0',
          100: '#FFEFB3',
          200: '#FFE082',
          300: '#FFD250',
          400: '#FFC627', // Official ASU Gold
          500: '#E5AE0F',
          600: '#B88A0A',
          700: '#8A6608',
          800: '#5C4305',
          900: '#3D2D03',
        },
        ink: {
          50: '#F4F1F2',
          100: '#D5CDD0',
          200: '#A89DA1',
          300: '#7A6E72',
          400: '#52464A',
          500: '#332B2E',
          600: '#22191D', // surface tertiary
          700: '#1C1015', // surface secondary (cards)
          800: '#160A0F', // surface primary (page)
          900: '#0F0709', // body bg
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Roboto', 'sans-serif'],
        display: ['Impact', 'Arial Narrow Bold', 'Bebas Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        wider: '0.08em',
        widest: '0.15em',
      },
    },
  },
  plugins: [],
} satisfies Config;
