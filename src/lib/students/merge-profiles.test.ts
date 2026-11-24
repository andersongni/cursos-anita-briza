import { describe, expect, it } from 'vitest'

/** Espelha a prioridade de matrícula usada em mergeProfiles. */
function enrollmentRank(s: string) {
  return s === 'ACTIVE' ? 3 : s === 'PENDING' ? 2 : s === 'INACTIVE' ? 1 : 0
}

function pickBestEnrollmentStatus(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return enrollmentRank(a) >= enrollmentRank(b) ? a : b
}

describe('merge-profiles enrollment rank', () => {
  it('prioriza ACTIVE sobre PENDING e INACTIVE', () => {
    expect(pickBestEnrollmentStatus('ACTIVE', 'PENDING')).toBe('ACTIVE')
    expect(pickBestEnrollmentStatus('PENDING', 'ACTIVE')).toBe('ACTIVE')
    expect(pickBestEnrollmentStatus('INACTIVE', 'PENDING')).toBe('PENDING')
    expect(pickBestEnrollmentStatus(null, 'ACTIVE')).toBe('ACTIVE')
    expect(pickBestEnrollmentStatus('REJECTED', 'INACTIVE')).toBe('INACTIVE')
  })
})
