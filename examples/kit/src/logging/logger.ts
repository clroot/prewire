import { InjectionToken } from '@prewire/core'

/**
 * Logging port of the product line. Plain TS interface — prewire has no
 * opinion about it; the token is the only lookup key, because interfaces
 * are erased at compile time.
 */
export interface Logger {
  info(message: string): void
}

export const LOGGER = new InjectionToken<Logger>('logger')
