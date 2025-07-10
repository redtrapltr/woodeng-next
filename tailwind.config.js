/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",  // <--- adjust these paths to fit your folder structure!
  ],
  theme: {
    extend: {
      animation: {
        'logo-glow': 'logo-glow 2.5s ease-in-out infinite',
        'fade-in-out': 'fade-in-out 3.2s ease-in-out infinite',
        'fade-in-out2': 'fade-in-out2 4s ease-in-out infinite',
        'fade-in-out3': 'fade-in-out3 3.7s ease-in-out infinite',
      },
      keyframes: {
        'logo-glow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.12)' },
        },
        'fade-in-out': {
          '0%, 100%': { opacity: '0.18' },
          '50%': { opacity: '0.42' },
        },
        'fade-in-out2': {
          '0%, 100%': { opacity: '0.22' },
          '50%': { opacity: '0.52' },
        },
        'fade-in-out3': {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '0.42' },
        },
      },
    },
  },
  plugins: [],
};
