import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--surface-highlight-rgb) / <alpha-value>)',
        cream: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        beige: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        lavender: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        gold: 'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        lightgold: 'rgb(var(--accent-gold-rgb) / <alpha-value>)',
        night: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
        ink: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-elevated-rgb) / <alpha-value>)',
        success: 'rgb(var(--status-success-rgb) / <alpha-value>)',
        danger: 'rgb(var(--status-danger-rgb) / <alpha-value>)'
      },
      boxShadow: {
        glow: 'var(--shadow-glass)',
        gold: 'var(--shadow-gold)'
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
