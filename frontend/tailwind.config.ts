import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7F4ED',
        beige: '#B7B2C6',
        lavender: '#B7B2C6',
        gold: '#D9AF46',
        lightgold: '#F4D67A',
        night: '#171326',
        ink: '#2B2542',
        surface: '#3A3452',
        success: '#79D99E',
        danger: '#FF7575'
      },
      boxShadow: {
        glow: '0 24px 70px rgba(0, 0, 0, 0.22)'
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
