import { InjectionToken } from '@prewire/core'

/**
 * Generic record port of the product line. One token serves every
 * record type: bindings and consumers specialize it with
 * `REPOSITORY.of<Repository<X>>()`, and codegen wires one implementation
 * per type argument. `any` in the generic position lets each
 * specialization narrow it.
 */
export interface Repository<T> {
  findById(id: string): Promise<T | undefined>
}

export const REPOSITORY = new InjectionToken<Repository<any>>('repository')
