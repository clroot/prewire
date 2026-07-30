import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/engine.ts', 'src/resolve.ts'],
  dts: true,
  fixedExtension: false,
})
