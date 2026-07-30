import { injectable } from '@prewire/core'
import type { Logger } from './ports'
import { LOGGER } from './tokens'

/** Kit default logger — `default: true` deliberately opens it for app override. */
export const consoleLogger = injectable(
  {},
  (): Logger => ({
    info: (message) => console.info(message),
  }),
  { provides: LOGGER, default: true },
)
