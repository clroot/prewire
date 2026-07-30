declare const TOKEN_TYPE: unique symbol

/**
 * 타입을 실어 나르는 주입 토큰.
 *
 * TS 인터페이스는 컴파일 후 사라지므로, 포트(인터페이스)는
 * 토큰을 통해서만 조회할 수 있다. 토큰 참조가 없으면 관련 바인딩이
 * 번들에서 tree-shaking 되는 것이 목표.
 */
export class InjectionToken<T> {
  declare readonly [TOKEN_TYPE]: T

  constructor(readonly description: string) {}

  toString(): string {
    return `InjectionToken<${this.description}>`
  }
}

export type ClassRef<T> = abstract new (...args: never[]) => T

export type Token<T> = InjectionToken<T> | ClassRef<T>

export type TokenType<Tk> = Tk extends Token<infer T> ? T : never
