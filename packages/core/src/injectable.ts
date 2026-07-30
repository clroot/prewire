import type { InjectionToken, TokenType } from './token'

/** Shape of a deps-as-data declaration — a static object literal of name → token. */
export type DepsShape = Record<string, InjectionToken<unknown>>

/** The deps object with every token replaced by its resolved instance type. */
export type ResolvedDeps<D extends DepsShape> = {
  [K in keyof D]: TokenType<D[K]>
}

export interface InjectableOptions<T> {
  /** The port token this binding implements. */
  provides: InjectionToken<T>
  /**
   * Environment-axis values this binding is valid in (user-defined —
   * business app, server/client, dev/test/prod, ...). Omit for all
   * environments (universal).
   */
  environment?: string | readonly string[]
  /**
   * Deliberate-openness marker (Kotlin `open` model — closed by default).
   * Only bindings marked `default: true` may be overridden by another
   * binding; an unmarked duplicate for the same token is a codegen
   * build error.
   */
  default?: boolean
}

/**
 * A binding declaration — the plain data record returned by injectable().
 *
 * It has no runtime behavior. Codegen reads this declaration statically
 * to generate the wiring, and the generated composition root calls
 * `factory` in topological order. Must be declared as a named
 * module-scope export.
 */
export interface Binding<T, D extends DepsShape = DepsShape> {
  readonly provides: InjectionToken<T>
  readonly deps: D
  readonly factory: (deps: ResolvedDeps<D>) => T
  readonly environment?: string | readonly string[]
  readonly default?: boolean
}

/**
 * Declares a binding. Function/factory providers are first-class and
 * deps are declared only as a static object literal — codegen reads the
 * literal without any type-checker magic.
 *
 * A mismatch between the deps object keys and the factory's destructured
 * keys is a compile error at the type level. A dep that is declared but
 * never used is caught by codegen as a build error.
 *
 * ```ts
 * export const stripeGateway = injectable(
 *   { logger: LOGGER },
 *   ({ logger }): PaymentGateway => new StripeGateway(logger),
 *   { provides: PAYMENT_GATEWAY, environment: 'server' },
 * )
 * ```
 */
// #__NO_SIDE_EFFECTS__ — declaring a binding is pure, so bundlers can
// drop unused declarations (and their factories) from app bundles.
export function injectable<T, const D extends DepsShape>(
  deps: D,
  factory: (deps: ResolvedDeps<D>) => T,
  options: InjectableOptions<T>,
): Binding<T, D> {
  return {
    provides: options.provides,
    deps,
    factory,
    environment: options.environment,
    default: options.default,
  }
}
