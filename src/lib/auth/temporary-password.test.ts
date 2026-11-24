import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TEMP_PASSWORD_HOURS,
  isTempPasswordActive,
  tempPasswordExpiresAt,
} from './temporary-password'

describe('temporary-password', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-24T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('expira em 2 horas', () => {
    expect(TEMP_PASSWORD_HOURS).toBe(2)
    const expires = tempPasswordExpiresAt()
    expect(expires.toISOString()).toBe('2026-11-24T14:00:00.000Z')
  })

  it('detecta ativo / expirado', () => {
    expect(isTempPasswordActive(new Date('2026-11-24T13:00:00.000Z'))).toBe(true)
    expect(isTempPasswordActive(new Date('2026-11-24T11:00:00.000Z'))).toBe(false)
    expect(isTempPasswordActive(null)).toBe(false)
    expect(isTempPasswordActive(undefined)).toBe(false)
    expect(isTempPasswordActive('2026-11-24T13:00:00.000Z')).toBe(true)
    expect(isTempPasswordActive('invalid-date')).toBe(false)
  })
})
