import { describe, expect, it } from 'vitest'
import { computeTypingStats, formatDurationMs, normalizePassageContent } from './typing'

describe('typing', () => {
  it('normaliza conteúdo', () => {
    expect(normalizePassageContent('a  \r\nb\r\n\n\n\nc  ')).toBe('a\nb\n\nc')
  })

  it('calcula stats', () => {
    const perfect = computeTypingStats({
      charsTotal: 175,
      errorCount: 0,
      durationMs: 60_000,
    })
    expect(perfect.wpm).toBe(35)
    expect(perfect.accuracy).toBe(100)
    expect(perfect.score).toBe(100)

    const empty = computeTypingStats({
      charsTotal: -1,
      errorCount: -2,
      durationMs: 0,
    })
    expect(empty.charsTotal).toBe(0)
    expect(empty.wpm).toBe(0)
    expect(empty.accuracy).toBe(0)
    expect(empty.score).toBe(0)

    const withErrors = computeTypingStats({
      charsTotal: 100,
      errorCount: 25,
      durationMs: 60_000,
    })
    expect(withErrors.accuracy).toBe(80)
    expect(withErrors.wpm).toBe(20)
    expect(withErrors.score).toBeGreaterThan(0)
    expect(withErrors.score).toBeLessThan(100)

    const slow = computeTypingStats({
      charsTotal: 5,
      errorCount: 0,
      durationMs: 120_000,
    })
    expect(slow.wpm).toBe(0.5)
    expect(slow.score).toBeLessThanOrEqual(100)
  })

  it('formata duração', () => {
    expect(formatDurationMs(-10)).toBe('0s')
    expect(formatDurationMs(500)).toBe('0s')
    expect(formatDurationMs(1000)).toBe('1s')
    expect(formatDurationMs(65_000)).toBe('1min 05s')
    expect(formatDurationMs(125_000)).toBe('2min 05s')
  })
})

