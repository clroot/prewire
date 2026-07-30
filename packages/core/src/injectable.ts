import type { Token } from './token'

export type Scope = 'singleton' | 'transient'

/** 바인딩이 유효한 환경. 코드젠이 server/client 조건부 바인딩에 사용한다. */
export type Environment = 'client' | 'server' | 'universal'

export interface InjectableOptions {
  /** @default 'singleton' */
  scope?: Scope
  /** @default 'universal' */
  environment?: Environment
  /** 이 클래스가 구현하는 포트 토큰 */
  provides?: Token<unknown>
}

/**
 * 마커 데코레이터(stage-3 네이티브, `experimentalDecorators` 불필요).
 *
 * 런타임 동작은 없다 — 실제 wiring은 `prewire codegen`이
 * 빌드 타임에 소스를 분석해 생성한다.
 */
export function Injectable(_options: InjectableOptions = {}) {
  return <T extends abstract new (...args: never[]) => object>(
    target: T,
    _context: ClassDecoratorContext,
  ): T => target
}
