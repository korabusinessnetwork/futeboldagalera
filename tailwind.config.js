/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta original PMNH (secao 11 da spec) = tema default do white-label.
        // Os tokens vivos vem de CSS vars, trocadas por tenant em applyTheme().
        bg: 'var(--bg)',
        card: 'var(--card)',
        card2: 'var(--card2)',
        line: 'var(--line)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        gold: '#ffd700',
        silver: '#c0c8d0',
        bronze: '#cd7f32',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
