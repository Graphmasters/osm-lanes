import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs', 'iife'],
  globalName: 'OsmLanes',
  dts: true,
  sourcemap: true,
  clean: true,
  // With "type": "module" tsup emits: esm → index.js, cjs → index.cjs, iife → index.global.js
  outExtension({ format }) {
    if (format === 'cjs') return { js: '.cjs' }
    if (format === 'iife') return { js: '.global.js' }
    return { js: '.js' }
  },
})
