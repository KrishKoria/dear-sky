import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      // The app, and the boundary diagram for the demo video (served at /boundary.html).
      input: { main: 'index.html', boundary: 'boundary.html' },
    },
  },
})
