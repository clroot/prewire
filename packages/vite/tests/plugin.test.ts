import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import { prewire } from '../src/index'

const CORE_DIR = resolve(import.meta.dirname, '../../core')

function scaffoldApp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'prewire-vite-'))
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'vite-app', private: true, type: 'module' }, null, 2)}\n`,
  )
  mkdirSync(join(dir, 'src'))
  writeFileSync(
    join(dir, 'src/tokens.ts'),
    `import { InjectionToken } from '@prewire/core'
export const APP_NAME = new InjectionToken<string>('app name')
export const GREETING = new InjectionToken<string>('greeting')
export const API_SECRET = new InjectionToken<string>('api secret')
`,
  )
  writeFileSync(
    join(dir, 'src/bindings.ts'),
    `import { injectable } from '@prewire/core'
import { API_SECRET, APP_NAME, GREETING } from './tokens'

export const appName = injectable({}, () => 'vite-integration-app', { provides: APP_NAME })
export const greeting = injectable({}, () => 'UNUSED_GREETING_MARKER', { provides: GREETING })
export const apiSecret = injectable({}, () => 'sk_live_secret', {
  provides: API_SECRET,
  environment: 'server',
})
`,
  )
  writeFileSync(
    join(dir, 'entry.ts'),
    `import { appName } from '#prewire'
console.log(appName)
`,
  )
  writeFileSync(
    join(dir, 'prewire.json'),
    `${JSON.stringify(
      {
        include: ['src'],
        environments: ['server', 'client'],
        defaultEnvironment: 'client',
        outDir: 'src/prewire',
      },
      null,
      2,
    )}\n`,
  )
  mkdirSync(join(dir, 'node_modules/@prewire'), { recursive: true })
  symlinkSync(CORE_DIR, join(dir, 'node_modules/@prewire/core'), 'dir')
  return dir
}

describe('@prewire/vite', () => {
  it('runs codegen, injects the alias, and bundles the client root', async () => {
    const dir = scaffoldApp()

    await build({
      root: dir,
      logLevel: 'silent',
      plugins: [prewire({ config: join(dir, 'prewire.json') })],
      build: {
        lib: { entry: join(dir, 'entry.ts'), formats: ['es'], fileName: 'out' },
        outDir: join(dir, 'dist'),
        minify: false,
      },
    })

    // Codegen ran at plugin instantiation.
    expect(existsSync(join(dir, 'src/prewire/container.client.gen.ts'))).toBe(true)

    const bundle = readFileSync(join(dir, 'dist/out.js'), 'utf8')
    // The consumed binding is wired in through the auto-injected alias.
    expect(bundle).toContain('vite-integration-app')
    // Server-only token: absent from the client root entirely.
    expect(bundle).not.toContain('sk_live_secret')
    // Unused universal binding: present in the root but tree-shaken from
    // the bundle (the /* @__PURE__ */ annotation at work).
    expect(bundle).not.toContain('UNUSED_GREETING_MARKER')
  })

  it('fails the build on a graph violation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prewire-vite-broken-'))
    mkdirSync(join(dir, 'src'))
    writeFileSync(
      join(dir, 'src/tokens.ts'),
      `import { InjectionToken } from '@prewire/core'
export const LOGGER = new InjectionToken<{ log(m: string): void }>('logger')
export const GREETER = new InjectionToken<{ greet(n: string): string }>('greeter')
`,
    )
    writeFileSync(
      join(dir, 'src/bindings.ts'),
      `import { injectable } from '@prewire/core'
import { GREETER, LOGGER } from './tokens'

export const greeter = injectable(
  { logger: LOGGER },
  ({ logger }) => ({ greet: (n: string) => (logger.log(n), n) }),
  { provides: GREETER },
)
`,
    )
    writeFileSync(
      join(dir, 'prewire.json'),
      `${JSON.stringify({ include: ['src'], environments: ['app'], outDir: 'src/prewire' })}\n`,
    )
    mkdirSync(join(dir, 'node_modules/@prewire'), { recursive: true })
    symlinkSync(CORE_DIR, join(dir, 'node_modules/@prewire/core'), 'dir')

    expect(() => prewire({ config: join(dir, 'prewire.json') })).toThrow('MISSING_BINDING')
  })
})
