/**
 * Build-time diagnostics. Every graph violation is collected (not thrown
 * one at a time) so a single codegen run reports everything at once, then
 * fails the build.
 */
export type DiagnosticCode =
  | 'BINDING_NOT_EXPORTED'
  | 'NON_STATIC_DECLARATION'
  | 'INVALID_TOKEN_REF'
  | 'UNUSED_DEP'
  | 'MISSING_BINDING'
  | 'CYCLE'
  | 'DUPLICATE_BINDING'
  | 'AMBIGUOUS_DEFAULTS'
  | 'EXPORT_NAME_COLLISION'
  | 'CONFIG_INVALID'

export interface Diagnostic {
  code: DiagnosticCode
  message: string
  /** Absolute path of the file the diagnostic points at, when known. */
  file?: string
}

export class DiagnosticBag {
  readonly items: Diagnostic[] = []

  add(code: DiagnosticCode, message: string, file?: string): void {
    this.items.push({ code, message, file })
  }

  get hasErrors(): boolean {
    return this.items.length > 0
  }

  format(): string {
    return this.items
      .map((d) => `[prewire] ${d.code}: ${d.message}${d.file ? `\n  at ${d.file}` : ''}`)
      .join('\n')
  }
}
