import { resolve } from 'node:path'
import { prewire } from '@prewire/vite'
import { defineConfig } from 'vite'

// The plugin runs codegen and injects the #prewire alias from the
// generated manifest — no manual prewireResolve line needed under Vite.
export default defineConfig({
  plugins: [prewire()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/main.ts'),
      formats: ['es'],
      fileName: 'support',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router'],
    },
    minify: false,
  },
})
