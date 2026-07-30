import { watch } from 'node:fs'
import { resolve } from 'node:path'
import type { FSWatcher } from 'node:fs'
import { loadConfig } from './config'
import { runCodegen } from './codegen'
import type { CodegenRunResult } from './codegen'

export interface WatchHandle {
  close(): void
}

export interface WatchCallbacks {
  /** Called after every codegen run (initial and re-runs). */
  onRun?: (result: CodegenRunResult) => void
  /** Called when a run throws (config unreadable, scan crash, ...). */
  onError?: (error: unknown) => void
}

/**
 * Runs codegen once, then re-runs it (debounced) whenever a scanned
 * source directory or the config file changes. Generated artifacts are
 * ignored so a write never retriggers the watcher. Shared by the CLI
 * `--watch` flag and the build-integration packages.
 */
export function watchCodegen(configPath: string, callbacks: WatchCallbacks = {}): WatchHandle {
  const run = (): void => {
    try {
      callbacks.onRun?.(runCodegen(loadConfig(configPath)))
    } catch (error) {
      callbacks.onError?.(error)
    }
  }
  run()

  const config = loadConfig(configPath)
  const watchers: FSWatcher[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = (path: string | null): void => {
    if (path !== null && /\.gen\.(ts|json)$/.test(path)) return
    clearTimeout(timer)
    timer = setTimeout(run, 100)
  }
  for (const dir of config.include) {
    watchers.push(
      watch(resolve(config.rootDir, dir), { recursive: true }, (_event, filename) =>
        schedule(filename),
      ),
    )
  }
  watchers.push(watch(config.configPath, () => schedule(null)))

  return {
    close: () => {
      clearTimeout(timer)
      for (const w of watchers) w.close()
    },
  }
}
