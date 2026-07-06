import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0f7f2',
          100: '#d9ede0',
          200: '#b3dac2',
          300: '#7ec09e',
          400: '#4ea07a',
          500: '#2e7d55',
          600: '#1e6040',
          700: '#1B3A2A',
          800: '#152d21',
          900: '#0f211a',
        },
        amber: {
          400: '#fbbf24',
          500: '#E87C2B',
          600: '#d97706',
        }
      },
    },
  },
  plugins: [],
}
export default config
