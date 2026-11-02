import type { DiagnosticBag } from './diagnostics'
import type { BindingDecl, TokenId, TokenRef } from './scan'
import { describeToken, tokenId } from './scan'

export interface ResolvedRoot {
  environment: string
  /** Winning bindings in topological order (dependencies first). */
  bindings: BindingDecl[]
  byToken: Map<TokenId, BindingDecl>
}

/**
 * Picks the winning binding for one token in one environment.
 *
 * Override contract (Kotlin `open` model — closed by default):
 * - exactly one unmarked binding wins over any number of `default: true`
 *   bindings (the declarer opened them for override);
 * - two or more unmarked bindings for the same token are a build error;
 * - among `default: true` candidates, an environment-specific binding
 *   beats a universal one; ties are a build error.
 */
function pickWinner(
  ref: TokenRef,
  candidates: BindingDecl[],
  environment: string,
  diagnostics: DiagnosticBag,
): BindingDecl | undefined {
  if (candidates.length === 1) return candidates[0]

  const overrides = candidates.filter((b) => !b.isDefault)
  if (overrides.length > 1) {
    diagnostics.add(
      'DUPLICATE_BINDING',
      `Token ${describeToken(ref)} has ${overrides.length} bindings without \`default: true\` in environment "${environment}". ` +
        `Mark the overridable one with \`default: true\`, or remove the duplicate: ` +
        overrides.map((b) => `${b.exportName} (${b.file})`).join(', '),
    )
    return undefined
  }
  if (overrides.length === 1) return overrides[0]

  const specific = candidates.filter((b) => b.environments !== undefined)
  if (specific.length === 1) return specific[0]
  const pool = specific.length > 1 ? specific : candidates
  diagnostics.add(
    'AMBIGUOUS_DEFAULTS',
    `Token ${describeToken(ref)} has multiple \`default: true\` bindings with equal specificity in environment "${environment}": ` +
      pool.map((b) => `${b.exportName} (${b.file})`).join(', '),
  )
  return undefined
}

/**
 * Resolves the composition root for one environment: filters bindings by
 * the active axis values ({environment} ∪ {app}), applies the override
 * contract per token, then validates the graph (missing bindings and
 * cycles are build errors) and returns bindings in topological order.
 */
export function resolveRoot(
  all: BindingDecl[],
  environment: string,
  app: string | undefined,
  diagnostics: DiagnosticBag,
): ResolvedRoot | undefined {
  const active = new Set([environment, ...(app ? [app] : [])])
  const matching = all.filter(
    (b) => b.environments === undefined || b.environments.some((e) => active.has(e)),
  )

  const groups = new Map<TokenId, BindingDecl[]>()
  for (const b of matching) {
    const id = tokenId(b.provides)
    const group = groups.get(id) ?? []
    group.push(b)
    groups.set(id, group)
  }

  const byToken = new Map<TokenId, BindingDecl>()
  for (const [id, group] of groups) {
    const winner = pickWinner(group[0]!.provides, group, environment, diagnostics)
    if (winner) byToken.set(id, winner)
  }
  if (diagnostics.hasErrors) return undefined

  for (const binding of byToken.values()) {
    for (const [depName, depRef] of Object.entries(binding.deps)) {
      const depId = tokenId(depRef)
      if (!byToken.has(depId)) {
        diagnostics.add(
          'MISSING_BINDING',
          `No binding for token ${describeToken(depRef)} in environment "${environment}" — ` +
            `required by dep "${depName}" of "${binding.exportName}" (${binding.file})`,
        )
      }
    }
  }
  if (diagnostics.hasErrors) return undefined

  // Post-order DFS: emits dependencies before their consumers and turns
  // any back edge into a CYCLE build error.
  const sortedIds = [...byToken.keys()].sort((a, b) => a.localeCompare(b))
  const done = new Set<TokenId>()
  const inProgress = new Set<TokenId>()
  const ordered: BindingDecl[] = []

  const visit = (id: TokenId, path: TokenId[]): boolean => {
    if (done.has(id)) return true
    if (inProgress.has(id)) {
      const cycleStart = path.indexOf(id)
      const cycle = [...path.slice(cycleStart), id]
        .map((step) => describeToken(byToken.get(step)!.provides))
        .join(' → ')
      diagnostics.add('CYCLE', `Dependency cycle detected: ${cycle}`)
      return false
    }
    inProgress.add(id)
    const binding = byToken.get(id)!
    for (const depRef of Object.values(binding.deps)) {
      if (!visit(tokenId(depRef), [...path, id])) return false
    }
    inProgress.delete(id)
    done.add(id)
    ordered.push(binding)
    return true
  }

  for (const id of sortedIds) {
    if (!visit(id, [])) return undefined
  }

  return { environment, bindings: ordered, byToken }
}
