import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  profile: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
}))

const hashMatchesWeakPassword = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/auth/weak-password', () => ({
  hashMatchesWeakPassword,
}))

import { scanAndFlagWeakStudentPasswords } from './scan-weak-passwords'

describe('scanAndFlagWeakStudentPasswords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.profile.update.mockResolvedValue({})
  })

  it('marca alunos com senha fraca no lote', async () => {
    prisma.profile.findMany.mockResolvedValueOnce([
      { id: 's1', password_hash: 'hash1' },
      { id: 's2', password_hash: 'hash2' },
    ])
    hashMatchesWeakPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const result = await scanAndFlagWeakStudentPasswords()
    expect(result).toEqual({ scanned: 2, flagged: 1 })
    expect(prisma.profile.update).toHaveBeenCalledTimes(2)
    expect(prisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'STUDENT',
          deleted_at: null,
          password_strength_checked_at: null,
        }),
      })
    )
  })

  it('filtra por curso quando informado', async () => {
    prisma.profile.findMany.mockResolvedValueOnce([])
    await scanAndFlagWeakStudentPasswords({ courseId: 'c1', limit: 5 })
    expect(prisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          enrollments: {
            some: { course_id: 'c1', status: 'ACTIVE' },
          },
        }),
      })
    )
  })

  it('limita o lote entre 1 e 40', async () => {
    prisma.profile.findMany.mockResolvedValueOnce([])
    await scanAndFlagWeakStudentPasswords({ limit: 0 })
    expect(prisma.profile.findMany.mock.calls[0][0].take).toBe(1)

    prisma.profile.findMany.mockResolvedValueOnce([])
    await scanAndFlagWeakStudentPasswords({ limit: 100 })
    expect(prisma.profile.findMany.mock.calls[1][0].take).toBe(40)
  })
})
