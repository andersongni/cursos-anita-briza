/** Janela de liberação da prova oficial (horas). */
export const PROVA_UNLOCK_WINDOW_HOURS = 2
/** Chave legada (global). Preferir `provaUnlockUntilKey(courseId)`. */
export const PROVA_UNLOCK_UNTIL_KEY = 'assessment.prova.unlock_until'

export function provaUnlockUntilKey(courseId: string): string {
  return `assessment.prova.unlock_until.${courseId}`
}
