/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
        },
        writer: {
          primary: '#2563eb',
          subtle: '#eff6ff',
          border: '#bfdbfe',
        },
        sheets: {
          primary: '#16a34a',
          subtle: '#f0fdf4',
          border: '#bbf7d0',
        },
        slides: {
          primary: '#ea580c',
          subtle: '#fff7ed',
          border: '#fed7aa',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
};
