import bcrypt from 'bcryptjs'

/** Senhas comuns demais para uso em produção (minúsculas, só dígitos/letras simples). */
export const COMMON_WEAK_PASSWORDS = [
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '123123',
  '111111',
  '000000',
  '654321',
  'password',
  'password1',
  'senha',
  'senha123',
  'qwerty',
  'abc123',
  'abcdef',
  'admin',
  'admin123',
  'aluno',
  'aluno123',
  'teste',
  'teste123',
  'mudar123',
] as const

/**
 * Heurística rápida (texto puro): lista comum, só dígitos curtos, ou senha igual ao usuário.
 */
export function isWeakPassword(
  password: string,
  opts?: { username?: string | null }
): boolean {
  const raw = password.trim()
  if (!raw) return true
  if (raw.length < 6) return true

  const lower = raw.toLowerCase()
  if ((COMMON_WEAK_PASSWORDS as readonly string[]).includes(lower)) return true

  // Sequências numéricas óbvias (ex.: 12345678 já coberto; 121212)
  if (/^(\d)\1{5,}$/.test(raw)) return true
  if (/^(012345|123456|234567|345678|456789|567890)+$/.test(raw)) return true

  const username = opts?.username?.trim().toLowerCase()
  if (username && lower === username) return true

  return false
}

/** Compara o hash salvo com a lista de senhas fracas (bcrypt). */
export async function hashMatchesWeakPassword(
  passwordHash: string
): Promise<boolean> {
  for (const candidate of COMMON_WEAK_PASSWORDS) {
    try {
      if (await bcrypt.compare(candidate, passwordHash)) return true
    } catch {
      // hash inválido — ignora
    }
  }
  return false
}
