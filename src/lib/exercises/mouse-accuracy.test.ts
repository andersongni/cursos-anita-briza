import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  MOUSE_ACCURACY_RANKING_SCALAR_FIELDS,
  MOUSE_ACCURACY_SPAWN_GAP_END_MS,
  MOUSE_ACCURACY_SPAWN_GAP_START_MS,
  MOUSE_ACCURACY_TARGET_GROW_MS,
  MOUSE_ACCURACY_TARGET_HOLD_MS,
  MOUSE_ACCURACY_TARGET_LIFETIME_MS,
  buildMouseAccuracyAttemptCreateData,
  buildMouseAccuracyPerformance,
  comboMultiplier,
  computeMouseAccuracyStats,
  formatRatePerSec,
  hitSpeedFactor,
  pointsForHit,
  spawnGapMs,
  targetScaleAtAge,
} from './mouse-accuracy'

describe('mouse-accuracy', () => {
  it('define multiplicadores de sequência', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(4)).toBe(1)
    expect(comboMultiplier(5)).toBe(1.5)
    expect(comboMultiplier(10)).toBe(2)
    expect(comboMultiplier(25)).toBe(2.5)
    expect(comboMultiplier(50)).toBe(3)
  })

  it('pontua mais acertos rápidos do que lentos', () => {
    expect(hitSpeedFactor(0)).toBe(1)
    expect(hitSpeedFactor(MOUSE_ACCURACY_TARGET_LIFETIME_MS)).toBe(0.25)
    expect(pointsForHit(1, 0)).toBeGreaterThan(pointsForHit(1, MOUSE_ACCURACY_TARGET_LIFETIME_MS))
    expect(pointsForHit(1, 0)).toBe(2)
    expect(pointsForHit(5, 0)).toBe(3)
    expect(pointsForHit(10, 0)).toBe(4)
  })

  it('monta indicadores de desempenho no modelo alvos/cliques', () => {
    expect(formatRatePerSec(19, 15_000)).toBe('1.3/s')
    expect(formatRatePerSec(5, 15_000)).toBe('0.3/s')
    const perf = buildMouseAccuracyPerformance({
      hits: 5,
      misses: 0,
      expired: 14,
      durationMs: 15_000,
    })
    expect(perf.targets).toBe(19)
    expect(perf.targetHits).toBe(5)
    expect(perf.notHit).toBe(14)
    expect(perf.targetRate).toBe('1.3/s')
    expect(perf.clicks).toBe(5)
    expect(perf.clickHits).toBe(5)
    expect(perf.clickMisses).toBe(0)
    expect(perf.clickRate).toBe('0.3/s')
  })

  it('mantém o alvo no tamanho máximo por 1s antes de encolher', () => {
    expect(targetScaleAtAge(0)).toBe(0)
    expect(targetScaleAtAge(-1)).toBe(0)
    expect(targetScaleAtAge(MOUSE_ACCURACY_TARGET_GROW_MS / 2)).toBeCloseTo(0.5)
    expect(targetScaleAtAge(MOUSE_ACCURACY_TARGET_GROW_MS)).toBe(1)
    expect(
      targetScaleAtAge(MOUSE_ACCURACY_TARGET_GROW_MS + MOUSE_ACCURACY_TARGET_HOLD_MS - 1)
    ).toBe(1)
    expect(
      targetScaleAtAge(MOUSE_ACCURACY_TARGET_GROW_MS + MOUSE_ACCURACY_TARGET_HOLD_MS + 1)
    ).toBeLessThan(1)
    expect(targetScaleAtAge(MOUSE_ACCURACY_TARGET_LIFETIME_MS)).toBe(0)
  })

  it('acelera o intervalo de surgimento de forma linear na partida', () => {
    expect(spawnGapMs(0)).toBe(MOUSE_ACCURACY_SPAWN_GAP_START_MS)
    expect(spawnGapMs(60_000)).toBe(MOUSE_ACCURACY_SPAWN_GAP_END_MS)
    expect(spawnGapMs(30_000)).toBe(
      Math.round((MOUSE_ACCURACY_SPAWN_GAP_START_MS + MOUSE_ACCURACY_SPAWN_GAP_END_MS) / 2)
    )
  })

  it('aplica bônus de precisão no final e média de reação', () => {
    const stats = computeMouseAccuracyStats({
      hits: 9,
      misses: 1,
      expired: 0,
      points: 400,
      durationMs: 60_000,
      maxCombo: 9,
      reactionSumMs: 9000,
    })
    expect(stats.accuracy).toBe(90)
    expect(stats.accuracyBonus).toBe(360)
    expect(stats.score).toBe(760)
    expect(stats.maxCombo).toBe(9)
    expect(stats.avgReactionMs).toBe(1000)
    expect(stats.expired).toBe(0)
  })

  it('conta alvos que sumiram na precisão', () => {
    const stats = computeMouseAccuracyStats({
      hits: 8,
      misses: 1,
      expired: 1,
      points: 100,
      durationMs: 60_000,
    })
    expect(stats.accuracy).toBe(80)
    expect(stats.expired).toBe(1)
  })

  it('trata partida sem cliques', () => {
    const stats = computeMouseAccuracyStats({
      hits: 0,
      misses: 0,
      points: 0,
      durationMs: 60_000,
    })
    expect(stats.accuracy).toBe(0)
    expect(stats.score).toBe(0)
    expect(stats.avgReactionMs).toBe(0)
  })

  /**
   * Regressão: salvar partida falhava com "Unknown argument `expired`/`avg_reaction_ms`"
   * quando o código usava campos fora do Prisma Client gerado (e o ranking não aparecia).
   */
  it('payload de create e select do ranking existem no Prisma Client gerado', () => {
    const allowed = new Set(Object.values(Prisma.MouseAccuracyAttemptScalarFieldEnum))
    const stats = computeMouseAccuracyStats({
      hits: 10,
      misses: 1,
      expired: 2,
      points: 50,
      durationMs: 60_000,
      maxCombo: 4,
      reactionSumMs: 4000,
    })
    const createData = buildMouseAccuracyAttemptCreateData('student-1', stats)

    for (const key of Object.keys(createData)) {
      expect(
        allowed.has(
          key as (typeof Prisma.MouseAccuracyAttemptScalarFieldEnum)[keyof typeof Prisma.MouseAccuracyAttemptScalarFieldEnum]
        ),
        `Campo de create ausente no Prisma Client: ${key}. Rode npx prisma generate.`
      ).toBe(true)
    }

    expect(createData.expired).toBe(2)
    expect(createData.avg_reaction_ms).toBe(400)

    for (const key of MOUSE_ACCURACY_RANKING_SCALAR_FIELDS) {
      expect(
        allowed.has(key),
        `Campo de ranking ausente no Prisma Client: ${key}. Rode npx prisma generate.`
      ).toBe(true)
    }

    const schema = readFileSync(
      path.resolve(process.cwd(), 'prisma/schema.prisma'),
      'utf8'
    )
    expect(schema).toMatch(/model MouseAccuracyAttempt[\s\S]*?\bexpired\b/)
    expect(schema).toMatch(/model MouseAccuracyAttempt[\s\S]*?\bavg_reaction_ms\b/)
  })
})
