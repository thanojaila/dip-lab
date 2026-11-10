import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Production-only CSP (the dev server injects inline styles, so it is not applied there).
 * 'unsafe-eval' is required by the vendored OpenCV.js (emscripten/embind uses new Function);
 * DIP Lab's own code never uses eval. Everything else is locked to same-origin: no network, no inline script.
 */
const csp = (): Plugin => ({
  name: 'dip-lab-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta name="color-scheme"',
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'" />\n    <meta name="color-scheme"`,
    ),
});

export default defineConfig({
  base: './',
  plugins: [csp()],
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
