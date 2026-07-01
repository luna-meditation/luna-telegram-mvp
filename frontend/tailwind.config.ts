import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fff6e8',
        beige: '#ead9c5',
        lavender: '#cfc3ff',
        gold: '#d8b45c',
        night: '#141227',
        ink: '#2b2542'
      },
      boxShadow: {
        glow: '0 24px 80px rgba(207, 195, 255, 0.28)'
      }
    }
  },
  plugins: []
} satisfies Config;
