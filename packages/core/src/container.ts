import type { Token } from './token'

/**
 * 코드젠이 생성하는 컨테이너의 형태.
 *
 * prewire에는 런타임 컨테이너 구현이 없다 — `prewire codegen`이
 * 의존성 그래프를 분석해 이 인터페이스를 만족하는 wiring 코드
 * (`container.gen.ts`)를 생성한다. 그래프 오류(바인딩 누락, 순환)는
 * 코드젠 시점에 빌드 에러로 잡는 것이 목표.
 */
export interface Container {
  get<T>(token: Token<T>): T
}
