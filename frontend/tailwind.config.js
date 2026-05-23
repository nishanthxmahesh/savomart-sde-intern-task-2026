/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        savo: {
          purple: '#782B90',
          'purple-dark': '#5C1F70',
          'purple-light': '#9B4FB8',
          'purple-50': '#F5EDF8',
          'purple-100': '#E5D2EE',
          yellow: '#FFF200',
          'yellow-soft': '#FFF9B0',
          ink: '#1A0E22',
          mist: '#FAF7FC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'savo-glow': '0 8px 24px -8px rgba(120,43,144,0.35)',
        'savo-card': '0 2px 8px rgba(26,14,34,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        shimmer: 'shimmer 1.8s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(120,43,144,0.5)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 14px rgba(120,43,144,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(120,43,144,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
};
