#!/usr/bin/env node
import { relative } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { loadConfig } from './config'
import { runCodegen } from './codegen'
import type { CodegenRunResult } from './codegen'
import { watchCodegen } from './watch'

function report(result: CodegenRunResult): boolean {
  if (result.diagnostics.hasErrors) {
    console.error(result.diagnostics.format())
    return false
  }
  for (const path of result.written) {
    console.log(`[prewire] wrote ${relative(process.cwd(), path)}`)
  }
  if (result.written.length === 0) {
    console.log('[prewire] up to date')
  }
  return true
}

const codegen = defineCommand({
  meta: {
    name: 'codegen',
    description:
      'Scan injectable() declarations and generate per-app composition roots (container.<env>.gen.ts)',
  },
  args: {
    config: {
      type: 'string',
      description: 'Path to prewire.json',
      default: 'prewire.json',
    },
    watch: {
      type: 'boolean',
      description: 'Re-run codegen when scanned sources change',
      default: false,
    },
  },
  run({ args }) {
    if (!args.watch) {
      if (!report(runCodegen(loadConfig(args.config)))) process.exitCode = 1
      return
    }
    watchCodegen(args.config, {
      onRun: report,
      onError: (error) => console.error(error instanceof Error ? error.message : error),
    })
    console.log('[prewire] watching for changes…')
  },
})

const main = defineCommand({
  meta: {
    name: 'prewire',
    description:
      'Compile-time DI for TypeScript monorepos — wired at build time, zero runtime container',
  },
  subCommands: {
    codegen,
  },
})

await runMain(main)
