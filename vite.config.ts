import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'

// The latin files the first screen is set in (see FONTS in src/fonts.ts). Their names are hashed,
// so they are found in the build by prefix.
const FIRST_SCREEN_FONTS = [
  'alegreya-latin-wght-normal-',
  'alegreya-latin-wght-italic-',
  'alegreya-sans-latin-400-normal-',
  'kalam-latin-400-normal-',
]

/**
 * Starts the first screen's fonts downloading with the HTML, not after the script has run and
 * the CSS has asked for them. The boundary diagram is left alone.
 */
function preloadFonts(): Plugin {
  return {
    name: 'preload-first-screen-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, path }) {
        if (!bundle || path !== '/index.html') return;
        return FIRST_SCREEN_FONTS.map((prefix) => {
          const file = Object.keys(bundle).find((name) => name.startsWith(`assets/${prefix}`) && name.endsWith('.woff2'));
          if (!file) throw new Error(`preload-first-screen-fonts: no built file for ${prefix}`);
          return {
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' },
            injectTo: 'head' as const,
          };
        });
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), preloadFonts()],
  build: {
    rollupOptions: {
      // The app, and the boundary diagram for the demo video (served at /boundary.html).
      input: { main: 'index.html', boundary: 'boundary.html' },
    },
  },
})
