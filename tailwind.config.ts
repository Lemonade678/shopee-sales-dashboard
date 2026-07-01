import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff3ec",
          100: "#ffe1cf",
          200: "#ffbf9e",
          300: "#ff9463",
          400: "#ff6a33",
          500: "#ee4d2d", // Shopee orange
          600: "#d63e1f",
          700: "#b23319",
          800: "#8f2a16",
          900: "#742513",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
