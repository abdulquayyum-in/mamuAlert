/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
      },
      colors: {
        neon: { pink: '#ff2e88', green: '#39ff88', cyan: '#22e4ff', yellow: '#ffe14d', purple: '#a855ff' },
        ink: { 900: '#07070c', 800: '#0f0f19', 700: '#171726', 600: '#232338' },
      },
      boxShadow: {
        neon: '0 0 18px rgba(255,46,136,.55)',
        'neon-green': '0 0 18px rgba(57,255,136,.5)',
      },
    },
  },
  plugins: [],
}
