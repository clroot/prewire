import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Per-app codegen configuration (`prewire.json` in the app root).
 *
 * Codegen runs once per app: each app scans its own dependency graph
 * (app + shared packages) and gets its own composition roots.
 */
export interface PrewireConfig {
  /**
   * Business-app axis value of this app (e.g. "storefront"). Bindings
   * conditioned on another app's value are excluded from this app's roots.
   */
  app?: string
  /** Directories (or files) to scan, relative to the config file. */
  include: string[]
  /** Environment-axis values — one composition root is emitted per value. */
  environments: string[]
  /**
   * Environment used for the editor-facing tsconfig paths mapping and the
   * `default` import condition. Falls back to the first environment.
   */
  defaultEnvironment?: string
  /** Output directory for generated roots, relative to the config file. */
  outDir: string
  /** The single specifier consumers import from. @default "#prewire" */
  specifier?: string
  /**
   * Environment → Node export-condition name. When present, codegen
   * updates the app package.json `imports` field so the specifier
   * resolves per condition (environment axis via module resolution).
   */
  conditions?: Record<string, string>
  /**
   * Emit `prewire.paths.gen.json` next to the config for the app tsconfig
   * to extend (business-app axis via per-app tsconfig paths / bundler
   * alias, since export conditions cannot vary per importing app).
   * @default true
   */
  tsconfigPaths?: boolean
}

export interface ResolvedConfig extends Required<Omit<PrewireConfig, 'app' | 'conditions'>> {
  app?: string
  conditions?: Record<string, string>
  /** Absolute directory containing the config file. */
  rootDir: string
  /** Absolute path of the config file. */
  configPath: string
}

export function loadConfig(configPath: string): ResolvedConfig {
  const absPath = resolve(configPath)
  const raw: unknown = JSON.parse(readFileSync(absPath, 'utf8'))
  return resolveConfig(raw, absPath)
}

export function resolveConfig(raw: unknown, absPath: string): ResolvedConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`[prewire] CONFIG_INVALID: ${absPath} must contain a JSON object`)
  }
  const cfg = raw as Partial<PrewireConfig>
  if (!Array.isArray(cfg.include) || cfg.include.length === 0) {
    throw new Error(`[prewire] CONFIG_INVALID: "include" must be a non-empty array (${absPath})`)
  }
  if (!Array.isArray(cfg.environments) || cfg.environments.length === 0) {
    throw new Error(
      `[prewire] CONFIG_INVALID: "environments" must be a non-empty array (${absPath})`,
    )
  }
  if (typeof cfg.outDir !== 'string' || cfg.outDir.length === 0) {
    throw new Error(`[prewire] CONFIG_INVALID: "outDir" is required (${absPath})`)
  }
  const defaultEnvironment = cfg.defaultEnvironment ?? cfg.environments[0]!
  if (!cfg.environments.includes(defaultEnvironment)) {
    throw new Error(
      `[prewire] CONFIG_INVALID: defaultEnvironment "${defaultEnvironment}" is not in environments (${absPath})`,
    )
  }
  return {
    app: cfg.app,
    include: cfg.include,
    environments: cfg.environments,
    defaultEnvironment,
    outDir: cfg.outDir,
    specifier: cfg.specifier ?? '#prewire',
    conditions: cfg.conditions,
    tsconfigPaths: cfg.tsconfigPaths ?? true,
    rootDir: dirname(absPath),
    configPath: absPath,
  }
}
