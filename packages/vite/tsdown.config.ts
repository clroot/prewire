import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  fixedExtension: false,
  external: ['unplugin', 'vite', 'webpack', '@rspack/core', 'rollup', 'esbuild'],
})
