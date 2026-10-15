/** Paleta oficial alineada con VR-Analytics (BI Solutions) */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff3e8',   // Fondo suave / badge / resaltado solicitado (#fff3e8)
          100: '#fedec2',  // Hover sutil / anillo claro
          200: '#fdc295',  // Borde y acento tenue
          300: '#fa9f58',  // Borde interactivo
          400: '#f2822a',  // Naranja intermedio
          500: '#e36e0d',  // Naranja de enfoque
          600: '#d76800',  // Naranja de marca primario (#d76800)
          700: '#d76800',  // Botones primarios, títulos, iconos y tabs activos (#d76800)
          800: '#a84300',  // Hover de botones / tono oscuro solicitado (#a84300)
          900: '#7a3100',  // Tono más oscuro de contraste
        },
        vr: {
          orange: '#d76800',
          dark: '#a84300',
          cream: '#fff3e8',
          blue: '#3563a9',
          navy: '#1e293b',
        },
        accent: {
          400: '#4c78bc',
          500: '#3563a9', // Azul cuadrante VR-Analytics
          600: '#274e89',
        },
      },
      fontFamily: {
        sans: ['"Outfit"', '"Inter"', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        'vr-glow': '0 4px 14px 0 rgba(215, 104, 0, 0.25)',
        'vr-subtle': '0 1px 4px 0 rgba(215, 104, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
