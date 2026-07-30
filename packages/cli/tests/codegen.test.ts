import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { planCodegen } from '../src/codegen'
import { resolveConfig } from '../src/config'
import type { PrewireConfig } from '../src/config'
import { deriveExportName, planPackageJsonImports } from '../src/emit'
import { prewireResolve } from '../src/resolve'

function makeProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  })
}

function makeConfig(overrides: Partial<PrewireConfig> = {}) {
  return resolveConfig(
    {
      include: ['src'],
      environments: ['app'],
      outDir: 'src/prewire',
      ...overrides,
    },
    '/app/prewire.json',
  )
}

const TOKENS = `
import { InjectionToken } from '@prewire/core'
export interface Logger { log(msg: string): void }
export interface Greeter { greet(name: string): string }
export const LOGGER = new InjectionToken<Logger>('logger')
export const GREETER = new InjectionToken<Greeter>('greeter')
`

describe('codegen — M1 MVP (AC1)', () => {
  it('emits a topologically sorted, eject-able plain factory root', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { GREETER, LOGGER } from './tokens'
      import type { Greeter, Logger } from './tokens'

      export const consoleLogger = injectable(
        {},
        (): Logger => ({ log: (msg) => console.log(msg) }),
        { provides: LOGGER },
      )

      export const politeGreeter = injectable(
        { logger: LOGGER },
        ({ logger }): Greeter => ({
          greet: (name) => {
            logger.log(name)
            return 'hello ' + name
          },
        }),
        { provides: GREETER },
      )
      `,
    )

    const plan = planCodegen(makeConfig(), project.getSourceFiles())
    expect(plan.diagnostics.items).toEqual([])

    const root = plan.outputs.get('/app/src/prewire/container.app.gen.ts')
    expect(root).toBeDefined()
    expect(root).toContain("import { consoleLogger as consoleLoggerBinding } from '../bindings'")
    expect(root).toContain('export const logger = /* @__PURE__ */ consoleLoggerBinding.factory({})')
    expect(root).toContain(
      'export const greeter = /* @__PURE__ */ politeGreeterBinding.factory({ logger })',
    )
    // Dependencies come before their consumers.
    expect(root!.indexOf('export const logger')).toBeLessThan(root!.indexOf('export const greeter'))

    expect(plan.outputs.get('/app/prewire.manifest.gen.json')).toContain(
      '"app": "./src/prewire/container.app.gen.ts"',
    )
    expect(plan.outputs.get('/app/prewire.paths.gen.json')).toContain('"#prewire"')
  })

  it('reports a missing binding as a build error', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { GREETER, LOGGER } from './tokens'
      import type { Greeter } from './tokens'

      export const politeGreeter = injectable(
        { logger: LOGGER },
        ({ logger }): Greeter => ({ greet: (name) => (logger.log(name), name) }),
        { provides: GREETER },
      )
      `,
    )

    const plan = planCodegen(makeConfig(), project.getSourceFiles())
    expect(plan.diagnostics.items.map((d) => d.code)).toContain('MISSING_BINDING')
    expect(plan.outputs.size).toBe(0)
  })

  it('reports a dependency cycle as a build error', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { GREETER, LOGGER } from './tokens'

      export const a = injectable(
        { greeter: GREETER },
        ({ greeter }) => ({ log: (m: string) => greeter.greet(m) }),
        { provides: LOGGER },
      )
      export const b = injectable(
        { logger: LOGGER },
        ({ logger }) => ({ greet: (n: string) => (logger.log(n), n) }),
        { provides: GREETER },
      )
      `,
    )

    const plan = planCodegen(makeConfig(), project.getSourceFiles())
    expect(plan.diagnostics.items.map((d) => d.code)).toContain('CYCLE')
  })

  it('reports a declared-but-unused dep as a build error', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { GREETER, LOGGER } from './tokens'

      export const logger = injectable({}, () => ({ log: () => {} }), { provides: LOGGER })
      export const greeter = injectable(
        { logger: LOGGER },
        () => ({ greet: (n: string) => n }),
        { provides: GREETER },
      )
      `,
    )

    const plan = planCodegen(makeConfig(), project.getSourceFiles())
    expect(plan.diagnostics.items.map((d) => d.code)).toContain('UNUSED_DEP')
  })

  it('requires bindings to be exported top-level consts', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from './tokens'

      const hidden = injectable({}, () => ({ log: () => {} }), { provides: LOGGER })
      `,
    )

    const plan = planCodegen(makeConfig(), project.getSourceFiles())
    expect(plan.diagnostics.items.map((d) => d.code)).toContain('BINDING_NOT_EXPORTED')
  })
})

describe('codegen — override contract (AC2)', () => {
  it('lets an unmarked app binding override a `default: true` shared binding', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/kit/logging.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from '../src/tokens'

      export const consoleLogger = injectable({}, () => ({ log: () => {} }), {
        provides: LOGGER,
        default: true,
      })
      `,
    )
    project.createSourceFile(
      '/app/src/logging.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from './tokens'

      export const jsonLogger = injectable({}, () => ({ log: () => {} }), { provides: LOGGER })
      `,
    )

    const plan = planCodegen(makeConfig({ include: ['src', 'kit'] }), project.getSourceFiles())
    expect(plan.diagnostics.items).toEqual([])
    const root = plan.outputs.get('/app/src/prewire/container.app.gen.ts')
    expect(root).toContain('jsonLoggerBinding.factory')
    expect(root).not.toContain('consoleLoggerBinding')
  })

  it('rejects duplicate bindings when none is marked `default: true`', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/a.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from './tokens'
      export const a = injectable({}, () => ({ log: () => {} }), { provides: LOGGER })
      `,
    )
    project.createSourceFile(
      '/app/src/b.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from './tokens'
      export const b = injectable({}, () => ({ log: () => {} }), { provides: LOGGER })
      `,
    )

    const plan = planCodegen(makeConfig(), project.getSourceFiles())
    expect(plan.diagnostics.items.map((d) => d.code)).toContain('DUPLICATE_BINDING')
  })

  it('prefers the environment-specific default over the universal default', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from './tokens'

      export const realLogger = injectable({}, () => ({ log: () => {} }), {
        provides: LOGGER,
        default: true,
      })
      export const fakeLogger = injectable({}, () => ({ log: () => {} }), {
        provides: LOGGER,
        environment: 'test',
        default: true,
      })
      `,
    )

    const plan = planCodegen(
      makeConfig({ environments: ['live', 'test'] }),
      project.getSourceFiles(),
    )
    expect(plan.diagnostics.items).toEqual([])
    expect(plan.outputs.get('/app/src/prewire/container.live.gen.ts')).toContain(
      'realLoggerBinding',
    )
    expect(plan.outputs.get('/app/src/prewire/container.test.gen.ts')).toContain(
      'fakeLoggerBinding',
    )
  })
})

describe('codegen — per-app roots and axes (AC3)', () => {
  it('keeps server-only tokens out of the client artifact entirely', () => {
    const project = makeProject()
    project.createSourceFile(
      '/app/src/tokens.ts',
      `
      import { InjectionToken } from '@prewire/core'
      export const API_SECRET = new InjectionToken<string>('api secret')
      export const APP_NAME = new InjectionToken<string>('app name')
      `,
    )
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { API_SECRET, APP_NAME } from './tokens'

      export const appName = injectable({}, () => 'shop', { provides: APP_NAME })
      export const apiSecret = injectable({}, () => 'sk_live', {
        provides: API_SECRET,
        environment: 'server',
      })
      `,
    )

    const plan = planCodegen(
      makeConfig({ environments: ['server', 'client'] }),
      project.getSourceFiles(),
    )
    expect(plan.diagnostics.items).toEqual([])
    const server = plan.outputs.get('/app/src/prewire/container.server.gen.ts')!
    const client = plan.outputs.get('/app/src/prewire/container.client.gen.ts')!
    expect(server).toContain('export const apiSecret')
    expect(client).not.toContain('apiSecret')
    expect(client).toContain('export const appName')
  })

  it('selects bindings by the business-app axis of the running app', () => {
    const project = makeProject()
    project.createSourceFile('/app/src/tokens.ts', TOKENS)
    project.createSourceFile(
      '/app/src/bindings.ts',
      `
      import { injectable } from '@prewire/core'
      import { LOGGER } from './tokens'

      export const storefrontLogger = injectable({}, () => ({ log: () => {} }), {
        provides: LOGGER,
        environment: 'storefront',
      })
      export const adminLogger = injectable({}, () => ({ log: () => {} }), {
        provides: LOGGER,
        environment: 'admin',
      })
      `,
    )

    const plan = planCodegen(makeConfig({ app: 'storefront' }), project.getSourceFiles())
    expect(plan.diagnostics.items).toEqual([])
    const root = plan.outputs.get('/app/src/prewire/container.app.gen.ts')!
    expect(root).toContain('storefrontLoggerBinding')
    expect(root).not.toContain('adminLoggerBinding')
  })

  it('wires the environment axis through package.json import conditions, default last', () => {
    const config = makeConfig({
      environments: ['live', 'test'],
      conditions: { live: 'default', test: 'prewire-test' },
    })
    const updated = planPackageJsonImports(config, '{\n  "name": "app"\n}\n')!
    const pkg = JSON.parse(updated) as {
      imports: Record<string, Record<string, string>>
    }
    const conditions = pkg.imports['#prewire']!
    expect(conditions['prewire-test']).toBe('./src/prewire/container.test.gen.ts')
    expect(conditions['default']).toBe('./src/prewire/container.live.gen.ts')
    expect(Object.keys(conditions).at(-1)).toBe('default')
  })
})

describe('deriveExportName', () => {
  it('maps token names to generated export identifiers', () => {
    expect(deriveExportName('ROUTER')).toBe('router')
    expect(deriveExportName('PAYMENT_GATEWAY')).toBe('paymentGateway')
    expect(deriveExportName('BillingService')).toBe('billingService')
  })
})

describe('prewireResolve', () => {
  it('resolves the specifier to the generated root of the requested environment', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prewire-'))
    writeFileSync(
      join(dir, 'prewire.manifest.gen.json'),
      JSON.stringify({
        specifier: '#prewire',
        defaultEnvironment: 'live',
        roots: {
          live: './src/prewire/container.live.gen.ts',
          test: './src/prewire/container.test.gen.ts',
        },
      }),
    )

    expect(prewireResolve({ env: 'test', dir })).toEqual({
      '#prewire': join(dir, 'src/prewire/container.test.gen.ts'),
    })
    expect(prewireResolve({ dir })['#prewire']).toContain('container.live.gen.ts')
    expect(() => prewireResolve({ env: 'nope', dir })).toThrow('not in the generated manifest')
  })
})
