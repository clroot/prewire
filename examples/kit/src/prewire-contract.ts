import type { Logger } from './logging/logger'
import type { RouterPort } from './router/router'

/**
 * The contract kit source expects any app's composition root to provide.
 *
 * Kit code imports '#prewire' like any consumer; WHICH root that
 * resolves to is decided by the importing app's build (dependency
 * inversion via module resolution). This file exists only so kit can
 * typecheck standalone: kit's own tsconfig maps '#prewire' here via
 * paths. Apps map the specifier to their generated roots instead, and
 * this file is never imported at runtime.
 */
export declare const logger: Logger
export declare const router: RouterPort
