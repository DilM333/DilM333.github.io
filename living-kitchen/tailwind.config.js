/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF6EE',
        ink: '#2B2420',
        clay: '#B4573F',
        leaf: '#4C7A5A',
        butter: '#E7A93F',
        berry: '#8C4A6B',
      },
      fontFamily: {
        sans: ['"Nunito"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 2px 10px rgba(43, 36, 32, 0.08)',
        soft: '0 1px 3px rgba(43, 36, 32, 0.06)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}

