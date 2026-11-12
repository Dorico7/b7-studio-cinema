import { defineConfig } from 'vite';

// base './' keeps the build portable: it works from a GitHub Pages project path
// (https://user.github.io/repo/) and from a local static server alike.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
  server: { host: '127.0.0.1', port: 5173 },
});
