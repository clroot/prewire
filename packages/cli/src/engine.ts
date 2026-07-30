/**
 * Programmatic surface of the codegen engine, consumed by the
 * build-integration packages (@prewire/vite, @prewire/next). The CLI is
 * a thin wrapper over this same API.
 */
export { loadConfig, resolveConfig } from './config'
export type { PrewireConfig, ResolvedConfig } from './config'
export { planCodegen, runCodegen } from './codegen'
export type { CodegenPlan, CodegenRunResult } from './codegen'
export { DiagnosticBag } from './diagnostics'
export type { Diagnostic, DiagnosticCode } from './diagnostics'
export { watchCodegen } from './watch'
export type { WatchCallbacks, WatchHandle } from './watch'
