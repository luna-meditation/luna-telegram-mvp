import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5F1E9',
        beige: '#C9BFD6',
        lavender: '#8E5FD6',
        gold: '#D4AF37',
        lightgold: '#F4D67A',
        night: '#1A1026',
        ink: '#241334',
        surface: '#4B2D6B',
        success: '#79D99E',
        danger: '#FF7575'
      },
      boxShadow: {
        glow: '0 24px 70px rgba(0, 0, 0, 0.28)',
        gold: '0 18px 50px rgba(212, 175, 55, 0.18)'
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config;
