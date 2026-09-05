/**
 * Tailwind 3 + autoprefixer, the standard pair.
 *
 * ESM `export default` because this package is `"type": "module"` — Next resolves this
 * file itself, and a `module.exports` here fails to load rather than silently doing
 * nothing, which shows up as an unstyled build.
 *
 * @type {import('postcss-load-config').Config}
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
