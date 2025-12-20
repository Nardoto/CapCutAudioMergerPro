/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E85A2A',
          hover: '#FF6B3D',
          light: '#FF8A65',
          dark: '#C94A1F',
        },
        background: {
          dark: '#0A0A0A',
          card: '#141414',
          elevated: '#1A1A1A',
          hover: '#252525',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A3A3A3',
          muted: '#666666',
        },
        border: {
          DEFAULT: '#2A2A2A',
          light: '#3A3A3A',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
