/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#7A2BF9" },
      },
    },
  },
  plugins: [require("tailwindcss-radix")()],
};
