import { prewireResolve } from '@prewire/cli/resolve'
import { defineConfig } from 'vitest/config'

// The one line that points `#prewire` at the test composition root.
// prewireResolve only runs while this config is evaluated (node), so it
// adds zero runtime surface to the app.
export default defineConfig({
  resolve: {
    alias: prewireResolve({ env: 'test', dir: import.meta.dirname }),
  },
})
