#!/usr/bin/env node
import { watch } from 'node:fs'
import { relative, resolve } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { loadConfig } from './config'
import { runCodegen } from './codegen'

function runOnce(configPath: string): boolean {
  const config = loadConfig(configPath)
  const result = runCodegen(config)
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
      if (!runOnce(args.config)) process.exitCode = 1
      return
    }

    const rerun = (): void => {
      try {
        runOnce(args.config)
      } catch (error) {
        console.error(error instanceof Error ? error.message : error)
      }
    }
    rerun()

    const config = loadConfig(args.config)
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = (path: string | null): void => {
      // Ignore our own outputs so a write does not retrigger the watcher.
      if (path !== null && /\.gen\.(ts|json)$/.test(path)) return
      clearTimeout(timer)
      timer = setTimeout(rerun, 100)
    }
    for (const dir of config.include) {
      watch(resolve(config.rootDir, dir), { recursive: true }, (_event, filename) =>
        schedule(filename),
      )
    }
    watch(config.configPath, () => schedule(null))
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
