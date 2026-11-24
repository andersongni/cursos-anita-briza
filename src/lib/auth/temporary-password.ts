/** Validade da senha temporária definida pelo admin (horas). */
export const TEMP_PASSWORD_HOURS = 2

export function tempPasswordExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + TEMP_PASSWORD_HOURS * 60 * 60 * 1000)
}

export function isTempPasswordActive(
  expiresAt: Date | string | null | undefined
): boolean {
  if (!expiresAt) return false
  const t = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  if (Number.isNaN(t.getTime())) return false
  return t.getTime() > Date.now()
}
