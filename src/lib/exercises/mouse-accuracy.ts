/** Regras fixas do exercício de precisão do mouse (configuração padrão do site). */

export const MOUSE_ACCURACY_DURATION_MS = 60_000
/** Contagem regressiva antes do primeiro alvo (ms). */
export const MOUSE_ACCURACY_COUNTDOWN_MS = 5_000
/** Segundos exibidos na contagem regressiva. */
export const MOUSE_ACCURACY_COUNTDOWN_SECONDS = 5
/** Tamanho grande: +2 pontos por acerto (antes do multiplicador). */
export const MOUSE_ACCURACY_POINTS_PER_HIT = 2
export const MOUSE_ACCURACY_MISS_PENALTY = 1
/** Penalidade quando o alvo some sem ser clicado. */
export const MOUSE_ACCURACY_EXPIRE_PENALTY = 1
/** Alvo grande (diâmetro máximo em px). */
export const MOUSE_ACCURACY_TARGET_MAX_PX = 96
/** Tempo para crescer até o tamanho máximo (ms). */
export const MOUSE_ACCURACY_TARGET_GROW_MS = 2400
/** Tempo parado no tamanho máximo antes de encolher (ms). */
export const MOUSE_ACCURACY_TARGET_HOLD_MS = 1000
/** Tempo para encolher até sumir (ms). */
export const MOUSE_ACCURACY_TARGET_SHRINK_MS = 2400
/** Vida total do alvo (cresce + espera + some). */
export const MOUSE_ACCURACY_TARGET_LIFETIME_MS =
  MOUSE_ACCURACY_TARGET_GROW_MS +
  MOUSE_ACCURACY_TARGET_HOLD_MS +
  MOUSE_ACCURACY_TARGET_SHRINK_MS

/** Escala do alvo (0–1) conforme a idade desde o surgimento. */
export function targetScaleAtAge(ageMs: number): number {
  if (ageMs <= 0) return 0
  if (ageMs >= MOUSE_ACCURACY_TARGET_LIFETIME_MS) return 0
  if (ageMs < MOUSE_ACCURACY_TARGET_GROW_MS) {
    return ageMs / MOUSE_ACCURACY_TARGET_GROW_MS
  }
  const holdEnd = MOUSE_ACCURACY_TARGET_GROW_MS + MOUSE_ACCURACY_TARGET_HOLD_MS
  if (ageMs < holdEnd) return 1
  const shrinkAge = ageMs - holdEnd
  return Math.max(0, 1 - shrinkAge / MOUSE_ACCURACY_TARGET_SHRINK_MS)
}
/**
 * Intervalo inicial entre surgimentos (ms).
 * Equivale à velocidade que antes só aparecia por volta dos 40s.
 */
export const MOUSE_ACCURACY_SPAWN_GAP_START_MS = 920
/**
 * Intervalo final entre surgimentos (ms).
 * Equivale à velocidade que antes aparecia aos ~45s (antes do pico final).
 */
export const MOUSE_ACCURACY_SPAWN_GAP_END_MS = 470
/** Quantidade máxima de alvos simultâneos no nível fácil. */
export const MOUSE_ACCURACY_MAX_TARGETS = 5
/** Quantidade inicial de alvos ao começar a partida. */
export const MOUSE_ACCURACY_INITIAL_TARGETS = 1

/** Intervalo de spawn: acelera de forma linear ao longo dos 60s. */
export function spawnGapMs(elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / MOUSE_ACCURACY_DURATION_MS))
  return Math.round(
    MOUSE_ACCURACY_SPAWN_GAP_START_MS +
      (MOUSE_ACCURACY_SPAWN_GAP_END_MS - MOUSE_ACCURACY_SPAWN_GAP_START_MS) * t
  )
}

export function comboMultiplier(hitsInRow: number): number {
  if (hitsInRow >= 50) return 3
  if (hitsInRow >= 25) return 2.5
  if (hitsInRow >= 10) return 2
  if (hitsInRow >= 5) return 1.5
  return 1
}

/**
 * Fator de velocidade: 1.0 no instante em que o alvo nasce,
 * ~0.25 perto de sumir. Acertos mais rápidos valem mais.
 */
export function hitSpeedFactor(ageMs: number): number {
  const age = Math.max(0, Math.min(ageMs, MOUSE_ACCURACY_TARGET_LIFETIME_MS))
  const remaining = 1 - age / MOUSE_ACCURACY_TARGET_LIFETIME_MS
  return 0.25 + 0.75 * remaining
}

/**
 * Pontos de um acerto: base × sequência × velocidade do clique.
 * `ageMs` = tempo desde o nascimento do alvo até o clique.
 */
export function pointsForHit(hitsInRowAfterHit: number, ageMs = 0): number {
  const base =
    MOUSE_ACCURACY_POINTS_PER_HIT *
    comboMultiplier(hitsInRowAfterHit) *
    hitSpeedFactor(ageMs)
  return Math.max(1, Math.round(base))
}

export function computeMouseAccuracyStats(input: {
  hits: number
  misses: number
  /** Alvos que sumiram sem clique. */
  expired?: number
  points: number
  durationMs: number
  maxCombo?: number
  /** Soma dos tempos de reação (ms) de cada acerto. */
  reactionSumMs?: number
}) {
  const hits = Math.max(0, Math.floor(input.hits))
  const misses = Math.max(0, Math.floor(input.misses))
  const expired = Math.max(0, Math.floor(input.expired ?? 0))
  const points = Math.floor(input.points)
  const durationMs = Math.max(1, Math.floor(input.durationMs))
  const maxCombo = Math.max(0, Math.floor(input.maxCombo ?? 0))
  const reactionSumMs = Math.max(0, Math.floor(input.reactionSumMs ?? 0))

  // Precisão considera cliques errados e alvos perdidos.
  const attempts = hits + misses + expired
  const accuracy = attempts > 0 ? (hits / attempts) * 100 : 0
  const accuracyBonus = Math.floor(Math.max(0, points) * (accuracy / 100))
  const score = Math.max(0, points) + accuracyBonus
  const avgReactionMs =
    hits > 0 ? Math.round((reactionSumMs / hits) * 10) / 10 : 0

  return {
    hits,
    misses,
    expired,
    points,
    durationMs,
    maxCombo,
    avgReactionMs,
    accuracy: Math.round(accuracy * 10) / 10,
    accuracyBonus,
    score,
  }
}

export type MouseAccuracyStats = ReturnType<typeof computeMouseAccuracyStats>

/**
 * Payload de create do Prisma — única fonte usada pela API.
 * Se adicionar campo aqui, rode `npx prisma generate` e atualize o schema.
 */
export function buildMouseAccuracyAttemptCreateData(
  studentId: string,
  stats: MouseAccuracyStats
) {
  return {
    student_id: studentId,
    duration_ms: stats.durationMs,
    hits: stats.hits,
    misses: stats.misses,
    expired: stats.expired,
    points: stats.points,
    accuracy: stats.accuracy,
    score: stats.score,
    max_combo: stats.maxCombo,
    avg_reaction_ms: stats.avgReactionMs,
  }
}

/** Campos escalares lidos no ranking (select do findMany). */
export const MOUSE_ACCURACY_RANKING_SCALAR_FIELDS = [
  'id',
  'student_id',
  'duration_ms',
  'hits',
  'misses',
  'expired',
  'points',
  'accuracy',
  'score',
  'max_combo',
  'avg_reaction_ms',
  'completed_at',
] as const

/** Taxa por segundo no formato `1.3/s`. */
export function formatRatePerSec(count: number, durationMs: number): string {
  const seconds = Math.max(0.001, durationMs / 1000)
  return `${(Math.max(0, count) / seconds).toFixed(1)}/s`
}

export function buildMouseAccuracyPerformance(input: {
  hits: number
  misses: number
  expired: number
  durationMs: number
}) {
  const hits = Math.max(0, Math.floor(input.hits))
  const misses = Math.max(0, Math.floor(input.misses))
  const expired = Math.max(0, Math.floor(input.expired))
  const durationMs = Math.max(1, Math.floor(input.durationMs))
  const targets = hits + expired
  const clicks = hits + misses

  return {
    targets,
    targetHits: hits,
    notHit: expired,
    targetRate: formatRatePerSec(targets, durationMs),
    clicks,
    clickHits: hits,
    clickMisses: misses,
    clickRate: formatRatePerSec(clicks, durationMs),
  }
}
