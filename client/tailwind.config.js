/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        brand: {
          50: '#F1F1FE', 100: '#E4E3FD', 200: '#CBCAFB', 300: '#A9A7F7', 400: '#8583F1',
          500: '#5E5CE6', 600: '#4D4AD4', 700: '#3F3CB2', 800: '#34328F', 900: '#2D2C72',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 18 35 / .05), 0 1px 1px rgb(16 18 35 / .03)',
        lift: '0 12px 32px -12px rgb(16 18 35 / .25), 0 2px 6px rgb(16 18 35 / .06)',
        pop: '0 24px 60px -20px rgb(16 18 35 / .35)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        flash: { '0%': { boxShadow: '0 0 0 0 rgb(94 92 230 / .5)' }, '100%': { boxShadow: '0 0 0 10px rgb(94 92 230 / 0)' } },
      },
      animation: { 'fade-up': 'fade-up .35s cubic-bezier(.2,.8,.2,1) both', flash: 'flash 1s ease-out' },
    },
  },
  plugins: [],
};
