import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)",
          foreground: "var(--primary-foreground)",
          50: "rgb(var(--brand-soft-rgb) / <alpha-value>)",
          100: "rgb(var(--brand-soft-rgb) / <alpha-value>)",
          500: "rgb(var(--brand-rgb) / <alpha-value>)",
          600: "rgb(var(--brand-rgb) / <alpha-value>)",
          700: "rgb(var(--brand-strong-rgb) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)",
          soft: "rgb(var(--brand-soft-rgb) / <alpha-value>)",
          strong: "rgb(var(--brand-strong-rgb) / <alpha-value>)",
        },
        // Secondary school colour per portal: gold on the admin side, pencil-yellow for students, etc.
        gold: {
          DEFAULT: "rgb(var(--gold-rgb) / <alpha-value>)",
          soft: "rgb(var(--gold-soft-rgb) / <alpha-value>)",
        },
        chalk: "rgb(var(--chalk-rgb) / <alpha-value>)",
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        // Warm "paper & ink" neutrals replace the cold slate scale everywhere.
        slate: {
          50: "#faf8f4",
          100: "#f3efe7",
          200: "#e7e1d4",
          300: "#d4ccbb",
          400: "#a39b8a",
          500: "#7a7364",
          600: "#5c5648",
          700: "#443f34",
          800: "#2c2922",
          900: "#1c1a15",
          950: "#100f0b",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        success: {
          DEFAULT: "#16a34a",
          50: "#f0fdf4",
          700: "#15803d",
        },
        warning: {
          DEFAULT: "#f59e0b",
          50: "#fffbeb",
          700: "#b45309",
        },
        danger: {
          DEFAULT: "#ef4444",
          50: "#fef2f2",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Georgia", "serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
      spacing: {
        4.5: "1.125rem",
        5.5: "1.375rem",
        8.5: "2.125rem",
        10.5: "2.625rem",
        11.5: "2.875rem",
        18: "4.5rem",
        84: "21rem",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "2xs": "0 1px 1px 0 rgba(28, 26, 21, 0.04)",
        xs: "0 1px 2px 0 rgba(28, 26, 21, 0.06)",
        subtle: "0 1px 2px 0 rgba(28, 26, 21, 0.04)",
        card: "0 1px 3px 0 rgba(28, 26, 21, 0.05), 0 1px 2px -1px rgba(28, 26, 21, 0.03)",
        "card-hover": "0 12px 24px -4px rgba(28, 26, 21, 0.08), 0 4px 6px -2px rgba(28, 26, 21, 0.03)",
        elevated: "0 20px 25px -5px rgba(28, 26, 21, 0.08), 0 8px 10px -6px rgba(28, 26, 21, 0.03)",
        glass: "0 8px 32px 0 rgba(28, 26, 21, 0.06)",
        glow: "0 0 24px -4px rgb(var(--brand-rgb) / 0.35)",
        // Solid "pressed paper" offset used by the new buttons
        press: "0 3px 0 0 rgb(var(--brand-strong-rgb) / 1)",
        "press-sm": "0 2px 0 0 rgb(var(--brand-strong-rgb) / 1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-subtle": "pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        "pop-in": "popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "rise-in": "riseIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        grow: "grow 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
        wiggle: "wiggle 1.4s ease-in-out infinite",
        "spin-slow": "spin 2.4s linear infinite",
        "load-bar": "loadBar 1.6s ease-in-out infinite",
        "logo-bounce": "logoBounce 1.4s ease-in-out infinite",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        grow: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0)" },
          "15%": { transform: "rotate(14deg)" },
          "30%": { transform: "rotate(-12deg)" },
          "45%": { transform: "rotate(8deg)" },
          "60%": { transform: "rotate(-4deg)" },
        },
        loadBar: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(260%)" },
        },
        logoBounce: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-10px) scale(1.04)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-8px) rotate(2deg)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.9) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
