import { defineConfig } from 'vite'

// The demo app is served from GitHub Pages at https://graphmasters.github.io/osm-lanes/.
export default defineConfig({
  root: 'app',
  base: '/osm-lanes/',
  publicDir: false,
  build: {
    outDir: '../_site',
    emptyOutDir: true,
    // MapLibre alone is ~1 MB minified; keep it in its own long-cacheable chunk.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { maplibre: ['maplibre-gl'] } },
    },
  },
})
