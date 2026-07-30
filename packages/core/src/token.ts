declare const TOKEN_TYPE: unique symbol

/**
 * An injection token that carries a type.
 *
 * TS interfaces are erased at compile time, so ports (interfaces) can
 * only be looked up through tokens. A token must be declared as a named
 * module-scope export — codegen identifies a token by its declaration
 * site (module path + export name) and derives the export identifier of
 * the generated artifact from that name.
 */
export class InjectionToken<T> {
  declare readonly [TOKEN_TYPE]: T

  constructor(readonly description: string) {}

  toString(): string {
    return `InjectionToken<${this.description}>`
  }
}

export type TokenType<Tk> = Tk extends InjectionToken<infer T> ? T : never
