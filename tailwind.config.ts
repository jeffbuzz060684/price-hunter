import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hunter: {
          50: "#f0fdf4",
          600: "#16a34a",
          700: "#15803d"
        }
      }
    }
  },
  plugins: []
};
export default config;
