/** Cálculo de desempenho e ranking do exercício de digitação. */

export function normalizePassageContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function computeTypingStats(input: {
  charsTotal: number
  errorCount: number
  durationMs: number
}) {
  const charsTotal = Math.max(0, Math.floor(input.charsTotal))
  const errorCount = Math.max(0, Math.floor(input.errorCount))
  const durationMs = Math.max(1, Math.floor(input.durationMs))

  const minutes = durationMs / 60000
  const wpm = charsTotal > 0 ? charsTotal / 5 / minutes : 0
  const keystrokes = charsTotal + errorCount
  const accuracy = keystrokes > 0 ? (charsTotal / keystrokes) * 100 : 0

  // Iniciantes: 35 PPM já vale a parte de velocidade; precisão pesa mais.
  const speedRatio = Math.min(1, wpm / 35)
  const score = Math.round(accuracy * 0.7 + speedRatio * 30)
  const clampedScore = Math.max(0, Math.min(100, score))

  return {
    charsTotal,
    errorCount,
    durationMs,
    wpm: Math.round(wpm * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    score: clampedScore,
  }
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m <= 0) return `${s}s`
  return `${m}min ${String(s).padStart(2, '0')}s`
}
