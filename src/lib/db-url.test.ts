import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

async function load() {
  return import('./db-url')
}

describe('getDatabaseUrl', () => {
  it('usa file local padrão sem env', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('TURSO_DATABASE_URL', '')
    vi.stubEnv('PROD_TURSO_DATABASE_URL', '')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_URL', '')
    const { getDatabaseUrl, getDatabasePath } = await load()
    const url = getDatabaseUrl()
    expect(url.startsWith('file:')).toBe(true)
    expect(url).toContain(path.join('prisma', 'dev.db'))
    expect(getDatabasePath()).toBe(url.replace(/^file:/, ''))
  })

  it('respeita DATABASE_URL local file relativo', async () => {
    vi.stubEnv('DATABASE_URL', 'file:./prisma/custom.db')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_URL', '')
    const { getDatabaseUrl } = await load()
    expect(getDatabaseUrl()).toContain(path.join('prisma', 'custom.db'))
  })

  it('mantém file absoluto e windows drive', async () => {
    vi.stubEnv('DATABASE_URL', 'file:/tmp/x.db')
    vi.stubEnv('VERCEL', '')
    const { getDatabaseUrl } = await load()
    expect(getDatabaseUrl()).toBe('file:/tmp/x.db')
  })

  it('resolve caminho file fora de prisma/', async () => {
    vi.stubEnv('DATABASE_URL', 'file:./data/app.db')
    vi.stubEnv('VERCEL', '')
    const { getDatabaseUrl } = await load()
    expect(getDatabaseUrl()).toContain(path.join('data', 'app.db'))
  })

  it('usa fallback Turso local quando sem DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('TURSO_DATABASE_URL', 'libsql://demo.turso.io')
    vi.stubEnv('VERCEL', '')
    const { getDatabaseUrl } = await load()
    expect(getDatabaseUrl()).toBe('libsql://demo.turso.io')
  })

  it('limpa aspas e espaços vazios', async () => {
    vi.stubEnv('DATABASE_URL', '""')
    vi.stubEnv('TURSO_DATABASE_URL', '  "https://db.example"  ')
    vi.stubEnv('VERCEL', '')
    const { getDatabaseUrl } = await load()
    expect(getDatabaseUrl()).toBe('https://db.example')
  })

  it('no Vercel exige URL remota', async () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_URL', 'app.vercel.app')
    vi.stubEnv('DATABASE_URL', 'file:./prisma/dev.db')
    vi.stubEnv('TURSO_DATABASE_URL', '')
    vi.stubEnv('PROD_TURSO_DATABASE_URL', '')
    const { getDatabaseUrl } = await load()
    expect(() => getDatabaseUrl()).toThrow(/Turso/)
  })

  it('no Vercel escolhe libsql entre candidatos', async () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_URL', 'app.vercel.app')
    vi.stubEnv('DATABASE_URL', 'file:./x.db')
    vi.stubEnv('PROD_TURSO_DATABASE_URL', 'libsql://prod.turso.io')
    const { getDatabaseUrl } = await load()
    expect(getDatabaseUrl()).toBe('libsql://prod.turso.io')
  })
})

describe('getDatabaseAuthToken', () => {
  it('retorna undefined para sqlite local', async () => {
    vi.stubEnv('DATABASE_URL', 'file:./prisma/dev.db')
    vi.stubEnv('TURSO_AUTH_TOKEN', 'tok')
    vi.stubEnv('VERCEL', '')
    const { getDatabaseAuthToken } = await load()
    expect(getDatabaseAuthToken()).toBeUndefined()
  })

  it('retorna token para URL remota', async () => {
    vi.stubEnv('DATABASE_URL', 'libsql://x.turso.io')
    vi.stubEnv('TURSO_AUTH_TOKEN', 'secret-token')
    vi.stubEnv('VERCEL', '')
    const { getDatabaseAuthToken } = await load()
    expect(getDatabaseAuthToken()).toBe('secret-token')
  })

  it('no Vercel exige token', async () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_URL', 'app.vercel.app')
    vi.stubEnv('DATABASE_URL', 'libsql://x.turso.io')
    vi.stubEnv('TURSO_AUTH_TOKEN', '')
    vi.stubEnv('DATABASE_AUTH_TOKEN', '')
    vi.stubEnv('PROD_TURSO_AUTH_TOKEN', '')
    const { getDatabaseAuthToken } = await load()
    expect(() => getDatabaseAuthToken()).toThrow(/TURSO_AUTH_TOKEN/)
  })

  it('aceita DATABASE_AUTH_TOKEN e PROD_TURSO_AUTH_TOKEN', async () => {
    vi.stubEnv('DATABASE_URL', 'https://x.turso.io')
    vi.stubEnv('TURSO_AUTH_TOKEN', '')
    vi.stubEnv('DATABASE_AUTH_TOKEN', 'from-db')
    vi.stubEnv('VERCEL', '')
    const mod = await load()
    expect(mod.getDatabaseAuthToken()).toBe('from-db')

    vi.resetModules()
    vi.stubEnv('DATABASE_AUTH_TOKEN', '')
    vi.stubEnv('PROD_TURSO_AUTH_TOKEN', 'from-prod')
    const mod2 = await load()
    expect(mod2.getDatabaseAuthToken()).toBe('from-prod')
  })
})
