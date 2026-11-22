import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // Tokens that night mode changes are CSS variables (set in app/globals.css).
      colors: {
        plum: "#35D7BB",
        "bg-primary": "rgb(var(--color-bg-primary) / <alpha-value>)",
        "bg-sidebar": "#2B2F36",
        "bg-navbar": "#373D49",
        "bg-highlight": "#1D212A",
        "bg-button-save": "#4A5261",
        "text-primary": "rgb(var(--color-text-primary) / <alpha-value>)",
        "text-invert": "rgb(var(--color-text-invert) / <alpha-value>)",
        "text-muted": "rgb(var(--color-text-muted) / <alpha-value>)",
        "border-light": "rgb(var(--color-border-light) / <alpha-value>)",
        "border-settings": "#4F535B",
        "icon-default": "rgb(var(--color-icon-default) / <alpha-value>)",
        "dropdown-link": "rgb(var(--color-dropdown-link) / <alpha-value>)",
        switchery: "#4B5363",
      },
      fontFamily: {
        sans: ['"Source Sans Pro"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        serif: ["Georgia", "Cambria", "serif"],
        mono: ['"Ubuntu Mono"', "Monaco", "monospace"],
      },
      spacing: {
        sidebar: "270px",
        gutter: "32px",
      },
      zIndex: {
        sidebar: "1",
        page: "2",
        editor: "3",
        preview: "4",
        overlay: "5",
        navbar: "6",
        settings: "7",
        modal: "50",
        toast: "60",
      },
      keyframes: {
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "in": "slide-in-from-right 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
      transitionDuration: {
        "250": "250ms",
      },
    },
  },
  plugins: [],
};

export default config;
