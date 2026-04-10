import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SSF Brand Colors
        ssf: {
          orange: "#F7941D",
          amber: "#FBBA00",
          maroon: "#7B1C24",
          "maroon-dark": "#4A1015",
        },
        // Dark theme surfaces
        surface: {
          DEFAULT: "#111111",
          50: "#1A1A1A",
          100: "#222222",
          200: "#2A2A2A",
          300: "#333333",
          400: "#3D3D3D",
        },
        // Semantic
        primary: {
          DEFAULT: "#F7941D",
          hover: "#E8850E",
          muted: "#F7941D22",
        },
        accent: {
          DEFAULT: "#FBBA00",
          muted: "#FBBA0022",
        },
        danger: {
          DEFAULT: "#EF4444",
          muted: "#EF444422",
        },
        success: {
          DEFAULT: "#22C55E",
          muted: "#22C55E22",
        },
        warning: {
          DEFAULT: "#F59E0B",
          muted: "#F59E0B22",
        },
        info: {
          DEFAULT: "#3B82F6",
          muted: "#3B82F622",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-ssf": "linear-gradient(135deg, #F7941D 0%, #FBBA00 100%)",
        "gradient-dark": "linear-gradient(180deg, #1A1A1A 0%, #111111 100%)",
        "gradient-maroon": "linear-gradient(135deg, #7B1C24 0%, #4A1015 100%)",
        "noise": "url('/noise.png')",
      },
      boxShadow: {
        "glow-orange": "0 0 20px rgba(247, 148, 29, 0.3)",
        "glow-amber": "0 0 20px rgba(251, 186, 0, 0.3)",
        "glow-sm": "0 0 10px rgba(247, 148, 29, 0.2)",
        "card": "0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)",
        "card-hover": "0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(247,148,29,0.15)",
      },
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
