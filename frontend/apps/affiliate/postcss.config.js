/**
 * Tailwind 3 + autoprefixer, the standard pair.
 *
 * ESM `export default` because this package is `"type": "module"` — a
 * `module.exports` here throws at Vite start rather than silently doing nothing.
 *
 * @type {import('postcss-load-config').Config}
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
