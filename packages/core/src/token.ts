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

  /**
   * Specializes a generic port by its concrete type. Codegen matches
   * specializations nominally — by the declaration sites of the types in
   * the type argument, never by structural assignability — so
   * `REPOSITORY.of<Repository<User>>()` and
   * `REPOSITORY.of<Repository<Order>>()` are distinct bindings, each with
   * its own override contract. Declare the base token with `any` in the
   * generic position (`InjectionToken<Repository<any>>`).
   *
   * Like the token itself, the type argument must be written out inline
   * at every use site: codegen reads it from the source, not from the
   * type checker.
   */
  of<U extends T>(): InjectionToken<U> {
    return this as unknown as InjectionToken<U>
  }

  toString(): string {
    return `InjectionToken<${this.description}>`
  }
}

export type TokenType<Tk> = Tk extends InjectionToken<infer T> ? T : never
