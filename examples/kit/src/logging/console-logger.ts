import { injectable } from '@prewire/core'
import type { Logger } from './logger'
import { LOGGER } from './logger'

/** Kit default logger — `default: true` deliberately opens it for app override. */
export const consoleLogger = injectable(
  {},
  (): Logger => ({
    info: (message) => console.info(message),
  }),
  { provides: LOGGER, default: true },
)
