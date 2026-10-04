import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Carrega .env.local (e opcionalmente .env.production.local) para scripts CLI. */
export function loadScriptEnv(options: { production?: boolean } = {}) {
  const loadEnvFile = (filePath: string, { override = false } = {}) => {
    if (!existsSync(filePath)) return
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value === '[SENSITIVE]' || value === 'SENSITIVE') continue
      if (override || !process.env[key]) {
        process.env[key] = value
      }
    }
  }

  loadEnvFile(resolve(process.cwd(), '.env'))
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  if (options.production) {
    loadEnvFile(resolve(process.cwd(), '.env.production.local'), { override: true })
  }
}
