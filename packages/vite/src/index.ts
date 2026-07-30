import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createUnplugin } from 'unplugin'
import { loadConfig, runCodegen } from '@prewire/cli/engine'
import type { ResolvedConfig } from '@prewire/cli/engine'

export interface PrewireOptions {
  /** Path to prewire.json, relative to the working directory. @default "prewire.json" */
  config?: string
  /**
   * Environment whose composition root the `#prewire` alias points at.
   * Defaults to the config's defaultEnvironment.
   */
  env?: string
}

interface Manifest {
  specifier: string
  defaultEnvironment: string
  roots: Record<string, string>
}

function runOrThrow(configPath: string): ResolvedConfig {
  const config = loadConfig(configPath)
  const result = runCodegen(config)
  if (result.diagnostics.hasErrors) {
    throw new Error(`prewire codegen failed:\n${result.diagnostics.format()}`)
  }
  return config
}

function aliasFor(config: ResolvedConfig, env: string | undefined): Record<string, string> {
  const manifestPath = resolve(config.rootDir, 'prewire.manifest.gen.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  const environment = env ?? manifest.defaultEnvironment
  const root = manifest.roots[environment]
  if (!root) {
    throw new Error(
      `[prewire] environment "${environment}" is not in the generated manifest ` +
        `(available: ${Object.keys(manifest.roots).join(', ')})`,
    )
  }
  return { [manifest.specifier]: resolve(dirname(manifestPath), root) }
}

/**
 * Build integration over the codegen engine (Vite/webpack/rspack via
 * unplugin). prewire emits files instead of transforming modules, so the
 * integration is bundler-agnostic:
 *
 * - codegen runs when the plugin is instantiated (config-evaluation
 *   time) and again on buildStart — graph violations fail the build;
 * - for Vite, the `#prewire` alias is injected automatically from the
 *   generated manifest (no manual prewireResolve line needed);
 * - watchChange re-runs codegen when a scanned source changes, and the
 *   rewritten root flows through the bundler's own HMR.
 */
export const PrewirePlugin = createUnplugin<PrewireOptions | undefined>((options = {}) => {
  const configPath = options.config ?? 'prewire.json'
  const config = runOrThrow(configPath)

  return {
    name: 'prewire',
    buildStart() {
      runOrThrow(configPath)
    },
    watchChange(id) {
      if (/\.gen\.(ts|json)$/.test(id)) return
      const inScope = config.include.some((dir) =>
        id.startsWith(`${resolve(config.rootDir, dir)}/`),
      )
      if (inScope) runOrThrow(configPath)
    },
    vite: {
      config() {
        return { resolve: { alias: aliasFor(config, options.env) } }
      },
    },
  }
})

/** Vite plugin. `webpack`/`rspack`/`rollup`/`esbuild` variants are on PrewirePlugin. */
export const prewire = PrewirePlugin.vite
