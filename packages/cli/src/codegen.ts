import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { SourceFile } from 'ts-morph'
import type { ResolvedConfig } from './config'
import { DiagnosticBag } from './diagnostics'
import { planOutputs, planPackageJsonImports } from './emit'
import { resolveRoot } from './graph'
import type { ResolvedRoot } from './graph'
import { createProject, scanBindings } from './scan'

export interface CodegenPlan {
  diagnostics: DiagnosticBag
  /** Absolute path → file content for every artifact to write. */
  outputs: Map<string, string>
  roots: ResolvedRoot[]
}

/**
 * Pure planning phase: scan → resolve one root per environment → render
 * artifacts. Callers pass pre-built source files (tests use an in-memory
 * project); nothing is written to disk here except that package.json is
 * read when import conditions are configured.
 */
export function planCodegen(config: ResolvedConfig, files: SourceFile[]): CodegenPlan {
  const diagnostics = new DiagnosticBag()
  const empty: CodegenPlan = { diagnostics, outputs: new Map(), roots: [] }

  const bindings = scanBindings(files, diagnostics)
  if (diagnostics.hasErrors) return empty

  const roots: ResolvedRoot[] = []
  for (const environment of config.environments) {
    const root = resolveRoot(bindings, environment, config.app, diagnostics)
    if (!root) return empty
    roots.push(root)
  }

  const outputs = planOutputs(config, roots, diagnostics)
  if (!outputs) return empty

  if (config.conditions) {
    const pkgPath = resolve(config.rootDir, 'package.json')
    if (!existsSync(pkgPath)) {
      diagnostics.add('CONFIG_INVALID', `"conditions" is set but ${pkgPath} does not exist`)
      return empty
    }
    const updated = planPackageJsonImports(config, readFileSync(pkgPath, 'utf8'))
    if (updated !== undefined) outputs.set(pkgPath, updated)
  }

  return { diagnostics, outputs, roots }
}

export interface CodegenRunResult {
  diagnostics: DiagnosticBag
  written: string[]
}

/** Full codegen run against the real filesystem for one app config. */
export function runCodegen(config: ResolvedConfig): CodegenRunResult {
  const { files } = createProject(config)
  const plan = planCodegen(config, files)
  if (plan.diagnostics.hasErrors) return { diagnostics: plan.diagnostics, written: [] }

  const written: string[] = []
  for (const [path, content] of plan.outputs) {
    // Skip untouched files so watchers and bundlers do not loop on rewrites.
    if (existsSync(path) && readFileSync(path, 'utf8') === content) continue
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
    written.push(path)
  }
  return { diagnostics: plan.diagnostics, written }
}
