import { randomInt } from 'crypto'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
/** Caracteres especiais simples (fáceis de digitar/ditar). */
const SPECIAL = '!@#$%&*?'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

export type PasswordComplexityResult =
  | { ok: true }
  | {
      ok: false
      error: string
    }

/** Exige maiúscula, minúscula, número e caractere especial simples. */
export function checkPasswordComplexity(password: string): PasswordComplexityResult {
  if (password.length < 8) {
    return { ok: false, error: 'A senha deve ter pelo menos 8 caracteres' }
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: 'A senha deve ter ao menos uma letra maiúscula' }
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: 'A senha deve ter ao menos uma letra minúscula' }
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: 'A senha deve ter ao menos um número' }
  }
  if (!/[!@#$%&*?]/.test(password)) {
    return {
      ok: false,
      error: 'A senha deve ter ao menos um caractere especial (!@#$%&*?)',
    }
  }
  return { ok: true }
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)]!
}

/** Gera senha com maiúsculas, minúsculas, números e um especial simples. */
export function generateStrongPassword(length = 10): string {
  const size = Math.max(length, 8)
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)]
  const rest: string[] = []
  for (let i = required.length; i < size; i++) {
    rest.push(pick(ALL))
  }
  const chars = [...required, ...rest]
  // Embaralha (Fisher–Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}
