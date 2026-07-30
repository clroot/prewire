#!/usr/bin/env node
// Committed bin shim: package managers link bins at install time, before
// dist/ exists in a fresh clone — this file exists so the link is always
// created, and it defers to the built CLI at run time.
import('../dist/index.js').catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('[prewire] dist/index.js is missing — build @prewire/cli first')
    process.exit(1)
  }
  throw error
})
