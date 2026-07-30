import { spawnSync } from 'node:child_process'
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
import { describe, expect, it } from 'vitest'
import { runCodegen } from '../src/codegen'
import { loadConfig } from '../src/config'

const CORE_DIR = resolve(import.meta.dirname, '../../core')
const CLI_ENTRY = resolve(import.meta.dirname, '../src/index.ts')

/** Scaffolds a real on-disk app with one universal and one server-only binding. */
function scaffoldApp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'prewire-it-'))
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'it-app', private: true, type: 'module' }, null, 2)}\n`,
  )
  mkdirSync(join(dir, 'src'))
  writeFileSync(
    join(dir, 'src/tokens.ts'),
    `import { InjectionToken } from '@prewire/core'
export const APP_NAME = new InjectionToken<string>('app name')
export const API_SECRET = new InjectionToken<string>('api secret')
`,
  )
  writeFileSync(
    join(dir, 'src/bindings.ts'),
    `import { injectable } from '@prewire/core'
import { API_SECRET, APP_NAME } from './tokens'

export const appName = injectable({}, () => 'integration-app', { provides: APP_NAME })
export const apiSecret = injectable({}, () => 'sk_live_secret', {
  provides: API_SECRET,
  environment: 'server',
})
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
        conditions: { server: 'react-server', client: 'default' },
      },
      null,
      2,
    )}\n`,
  )
  // The generated roots import bindings, which import '@prewire/core' —
  // link the real workspace package so the fixture resolves it.
  mkdirSync(join(dir, 'node_modules/@prewire'), { recursive: true })
  symlinkSync(CORE_DIR, join(dir, 'node_modules/@prewire/core'), 'dir')
  return dir
}

describe('codegen against the real filesystem', () => {
  const dir = scaffoldApp()
  const config = loadConfig(join(dir, 'prewire.json'))

  it('writes roots, manifest, paths, and the package.json imports field', () => {
    const result = runCodegen(config)
    expect(result.diagnostics.items).toEqual([])

    for (const file of [
      'src/prewire/container.server.gen.ts',
      'src/prewire/container.client.gen.ts',
      'prewire.manifest.gen.json',
      'prewire.paths.gen.json',
    ]) {
      expect(existsSync(join(dir, file)), file).toBe(true)
    }

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      imports: Record<string, Record<string, string>>
    }
    const conditions = pkg.imports['#prewire']!
    expect(conditions['react-server']).toBe('./src/prewire/container.server.gen.ts')
    expect(conditions['default']).toBe('./src/prewire/container.client.gen.ts')
    expect(Object.keys(conditions).at(-1)).toBe('default')
  })

  it('is idempotent — a second run rewrites nothing', () => {
    expect(runCodegen(config).written).toEqual([])
  })

  it('resolves #prewire per environment at runtime through import conditions', () => {
    writeFileSync(
      join(dir, 'entry.mjs'),
      `const root = await import('#prewire')
console.log(JSON.stringify(Object.keys(root).sort()))
`,
    )

    const run = (...flags: string[]) => {
      const proc = spawnSync('bun', [...flags, 'entry.mjs'], { cwd: dir, encoding: 'utf8' })
      expect(proc.status, proc.stderr).toBe(0)
      return JSON.parse(proc.stdout.trim()) as string[]
    }

    // Default condition → client root: the server-only token is ABSENT.
    expect(run()).toEqual(['appName'])
    // RSC-style condition → server root: same specifier, different wiring.
    expect(run('--conditions=react-server')).toEqual(['apiSecret', 'appName'])
  })

  it('exits 0 from the CLI on a valid graph', () => {
    const proc = spawnSync('bun', [CLI_ENTRY, 'codegen'], { cwd: dir, encoding: 'utf8' })
    expect(proc.status, proc.stderr).toBe(0)
    expect(proc.stdout).toMatch(/wrote|up to date/)
  })
})

describe('CLI failure path', () => {
  it('exits 1 and prints the diagnostic on a broken graph', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prewire-it-broken-'))
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

    const proc = spawnSync('bun', [CLI_ENTRY, 'codegen'], { cwd: dir, encoding: 'utf8' })
    expect(proc.status).toBe(1)
    expect(proc.stderr).toContain('MISSING_BINDING')
    expect(existsSync(join(dir, 'src/prewire'))).toBe(false)
  })
})
