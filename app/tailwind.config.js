/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{svelte,ts,js}"],
  theme: {
    extend: {
      screens: {
        sm: "540px",  // Mobile breakpoint: below 540px is mobile, above is desktop
      },
      colors: {
        ink: "#0a0a0a",
        cream: "#faf7f2",
        red: { swiss: "#da291c" },
        accent: "#d97706",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
