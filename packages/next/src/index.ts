import { loadConfig, runCodegen, watchCodegen } from '@prewire/cli/engine'
import type { WatchHandle } from '@prewire/cli/engine'

/** Next.js phase constant (stable public value, avoids depending on next). */
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server'

export interface WithPrewireOptions {
  /** Path to prewire.json, relative to the working directory. @default "prewire.json" */
  config?: string
  /** Disable the source watcher during `next dev`. @default false */
  disableWatch?: boolean
}

/**
 * Minimal structural stand-in for Next's config function form — kept
 * local so @prewire/next does not depend on the next package.
 */
export type NextConfigFn<C> = (phase: string, context: { defaultConfig: unknown }) => C | Promise<C>

const watchers = new Map<string, WatchHandle>()

/** Stops every dev watcher started by withPrewire (test/teardown helper). */
export function stopPrewireWatchers(): void {
  for (const handle of watchers.values()) handle.close()
  watchers.clear()
}

function runOrThrow(configPath: string): void {
  const result = runCodegen(loadConfig(configPath))
  if (result.diagnostics.hasErrors) {
    throw new Error(`prewire codegen failed:\n${result.diagnostics.format()}`)
  }
}

/**
 * next.config wrapper. Turbopack exposes no bundler hooks, so the
 * integration lives entirely outside the bundler — prewire emits files
 * rather than transforming modules:
 *
 * - codegen runs synchronously while the config is evaluated (both
 *   `next build` and `next dev`); graph violations fail the command;
 * - during `next dev`, a source watcher keeps the composition roots in
 *   sync next to the dev server (the contentlayer precedent) — the dev
 *   server picks up the rewritten root like any source change.
 *
 * ```ts
 * // next.config.ts
 * import { withPrewire } from '@prewire/next'
 * export default withPrewire({ reactStrictMode: true })
 * ```
 */
export function withPrewire<C extends object>(
  nextConfig: C | NextConfigFn<C>,
  options: WithPrewireOptions = {},
): NextConfigFn<C> {
  const configPath = options.config ?? 'prewire.json'
  return async (phase, context) => {
    runOrThrow(configPath)
    if (phase === PHASE_DEVELOPMENT_SERVER && !options.disableWatch && !watchers.has(configPath)) {
      watchers.set(
        configPath,
        watchCodegen(configPath, {
          onRun: (result) => {
            if (result.diagnostics.hasErrors) console.error(result.diagnostics.format())
          },
          onError: (error) => console.error(error instanceof Error ? error.message : error),
        }),
      )
    }
    return typeof nextConfig === 'function' ? nextConfig(phase, context) : nextConfig
  }
}
