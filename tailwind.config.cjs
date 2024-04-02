/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  corePlugins: {
    preflight: true,
  },
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        spacing: {
          '128': '32rem',
        },
        primary: {
          500: '#10A37F',
          600: '#0794A6',
          700: '#374151'
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  safelist: [{
    pattern: /^(border|text|bg|prose)-/
  }],
}
