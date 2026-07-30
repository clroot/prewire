import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface Manifest {
  specifier: string
  defaultEnvironment: string
  roots: Record<string, string>
}

export interface PrewireResolveOptions {
  /** Environment-axis value to resolve the specifier to. */
  env?: string
  /**
   * Directory containing `prewire.manifest.gen.json` (the app root).
   * @default process.cwd()
   */
  dir?: string
}

/**
 * Build-time resolution helper for JS/TS config files (vitest.config,
 * next.config, ...). prewire never patches user config files — the user
 * adds this one line instead:
 *
 * ```ts
 * export default defineConfig({
 *   resolve: { alias: prewireResolve({ env: 'test' }) },
 * })
 * ```
 *
 * It only ever runs while the config file is evaluated (node), so it adds
 * zero runtime surface to the app bundle. Requires `prewire codegen` to
 * have produced `prewire.manifest.gen.json`.
 */
export function prewireResolve(options: PrewireResolveOptions = {}): Record<string, string> {
  const dir = resolve(options.dir ?? process.cwd())
  const manifestPath = resolve(dir, 'prewire.manifest.gen.json')
  let manifest: Manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  } catch (cause) {
    throw new Error(
      `[prewire] prewireResolve could not read ${manifestPath} — run \`prewire codegen\` first`,
      { cause },
    )
  }
  const env = options.env ?? manifest.defaultEnvironment
  const root = manifest.roots[env]
  if (!root) {
    throw new Error(
      `[prewire] environment "${env}" is not in the generated manifest ` +
        `(available: ${Object.keys(manifest.roots).join(', ')}) — check prewire.json environments`,
    )
  }
  return { [manifest.specifier]: resolve(dirname(manifestPath), root) }
}
