import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — warm, friendly, gift-like
        brand: {
          50:  '#fff1f7',
          100: '#ffe4f0',
          200: '#ffc8e1',
          300: '#ff99c5',
          400: '#ff5fa0',
          500: '#ff2d7b',
          600: '#f0085a',
          700: '#cc0048',
          800: '#a8003e',
          900: '#8c0037',
        },
        violet: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Warm complementary accents
        coral: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        cream: {
          50: '#fefdf8',
          100: '#fdf9e7',
          200: '#fbf2c9',
        },
        ink: {
          900: '#0f0a1e',
          800: '#1a1228',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Display sizes
        'display-xl': ['clamp(3.5rem, 8vw, 6.5rem)', { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '800' }],
        'display-lg': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-md': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
      },
      backgroundImage: {
        'gradient-celebratory': 'linear-gradient(135deg, #ff2d7b 0%, #fb923c 60%, #fbbf24 100%)',
        'gradient-soft': 'linear-gradient(135deg, #fff1f7 0%, #fef3c7 100%)',
        'gradient-violet-pink': 'linear-gradient(135deg, #a78bfa 0%, #ff5fa0 100%)',
        'gradient-cream-coral': 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
        'gradient-pink-coral': 'linear-gradient(135deg, #ff99c5 0%, #fb923c 100%)',
      },
      boxShadow: {
        'soft': '0 2px 12px -2px rgb(255 45 123 / 0.08), 0 4px 24px -8px rgb(15 10 30 / 0.06)',
        'lifted': '0 12px 40px -12px rgb(255 45 123 / 0.18), 0 8px 24px -8px rgb(15 10 30 / 0.08)',
        'pressed': 'inset 0 2px 4px 0 rgb(15 10 30 / 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'stagger': 'stagger 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-ring': 'pulseRing 1.2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        stagger: {
          '0%': { transform: 'translateY(16px) scale(0.96)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgb(255 45 123 / 0.7)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 12px rgb(255 45 123 / 0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgb(255 45 123 / 0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
