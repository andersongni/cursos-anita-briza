import { beforeEach, describe, expect, it, vi } from 'vitest'

type Tx = {
  profile: { update: ReturnType<typeof vi.fn> }
  assessment: { updateMany: ReturnType<typeof vi.fn> }
  certificate: { updateMany: ReturnType<typeof vi.fn> }
  typingAttempt: { updateMany: ReturnType<typeof vi.fn> }
  mouseAccuracyAttempt: { updateMany: ReturnType<typeof vi.fn> }
  feedback: { updateMany: ReturnType<typeof vi.fn> }
  attemptRelease: { updateMany: ReturnType<typeof vi.fn> }
  courseEnrollment: {
    delete: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  profileMerge: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
}

const prisma = vi.hoisted(() => {
  const tx: Tx = {
    profile: { update: vi.fn() },
    assessment: { updateMany: vi.fn() },
    certificate: { updateMany: vi.fn() },
    typingAttempt: { updateMany: vi.fn() },
    mouseAccuracyAttempt: { updateMany: vi.fn() },
    feedback: { updateMany: vi.fn() },
    attemptRelease: { updateMany: vi.fn() },
    courseEnrollment: {
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    profileMerge: { create: vi.fn(), update: vi.fn() },
  }

  return {
    tx,
    profile: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    profileMerge: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assessment: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    certificate: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    typingAttempt: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    mouseAccuracyAttempt: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    feedback: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    attemptRelease: { findMany: vi.fn(), updateMany: vi.fn() },
    courseEnrollment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (t: Tx) => unknown) => fn(tx)),
  }
})

vi.mock('@/lib/db', () => ({ prisma }))

import {
  canUndoMerge,
  getMergePreview,
  mergeProfiles,
  undoMergeProfiles,
} from './merge-profiles'

const survivorBase = {
  id: 'surv-1',
  username: 'ana',
  full_name: 'Ana Silva',
  email: 'ana@x.com',
  phone: '11999999999',
  status: 'APPROVED',
  deleted_at: null,
  role: 'STUDENT',
  password_hash: 'hash-ana',
  password_is_weak: false,
  password_strength_checked_at: null,
}

const absorbedBase = {
  id: 'abs-1',
  username: 'bia',
  full_name: 'Bia Souza',
  email: null,
  phone: '11888888888',
  status: 'APPROVED',
  deleted_at: null,
  role: 'STUDENT',
  password_hash: 'hash-bia',
  password_is_weak: true,
  password_strength_checked_at: new Date('2026-01-01'),
}

function mockEmptyHistory() {
  prisma.assessment.count.mockResolvedValue(0)
  prisma.certificate.count.mockResolvedValue(0)
  prisma.typingAttempt.count.mockResolvedValue(0)
  prisma.mouseAccuracyAttempt.count.mockResolvedValue(0)
  prisma.feedback.count.mockResolvedValue(0)
}

describe('getMergePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmptyHistory()
  })

  it('retorna prévia ok', async () => {
    prisma.profile.findUnique
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce(absorbedBase)
    prisma.assessment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1)

    const preview = await getMergePreview('surv-1', 'abs-1')
    expect(preview.ok).toBe(true)
    if (preview.ok) {
      expect(preview.survivor.username).toBe('ana')
      expect(preview.absorbed.fullName).toBe('Bia Souza')
      expect(preview.survivor.history.assessments).toBe(2)
    }
  })

  it('rejeita alunos inválidos', async () => {
    prisma.profile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    expect((await getMergePreview('x', 'y')).ok).toBe(false)

    prisma.profile.findUnique
      .mockResolvedValueOnce({ ...survivorBase, role: 'ADMIN' })
      .mockResolvedValueOnce(absorbedBase)
    expect((await getMergePreview('surv-1', 'abs-1')).ok).toBe(false)

    prisma.profile.findUnique
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce(survivorBase)
    expect((await getMergePreview('surv-1', 'surv-1')).ok).toBe(false)

    prisma.profile.findUnique
      .mockResolvedValueOnce({ ...survivorBase, deleted_at: new Date() })
      .mockResolvedValueOnce(absorbedBase)
    expect((await getMergePreview('surv-1', 'abs-1')).ok).toBe(false)

    prisma.profile.findUnique
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce({ ...absorbedBase, deleted_at: new Date() })
    expect((await getMergePreview('surv-1', 'abs-1')).ok).toBe(false)
  })
})

describe('mergeProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmptyHistory()
    prisma.profile.findUnique
      .mockResolvedValue(survivorBase)
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce(absorbedBase)
    prisma.profile.findUniqueOrThrow
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce(absorbedBase)
    prisma.profileMerge.findFirst.mockResolvedValue(null)
    prisma.assessment.findMany.mockResolvedValue([{ id: 'a1' }])
    prisma.certificate.findMany.mockResolvedValue([])
    prisma.typingAttempt.findMany.mockResolvedValue([])
    prisma.mouseAccuracyAttempt.findMany.mockResolvedValue([])
    prisma.feedback.findMany.mockResolvedValue([])
    prisma.attemptRelease.findMany.mockResolvedValue([])
    prisma.courseEnrollment.findMany
      .mockResolvedValueOnce([{ id: 'e1', course_id: 'c1', status: 'PENDING' }])
      .mockResolvedValueOnce([{ id: 'e2', course_id: 'c1', status: 'ACTIVE' }])
    prisma.tx.profileMerge.create.mockResolvedValue({
      id: 'm1',
      survivor_id: 'surv-1',
      absorbed_id: 'abs-1',
    })
    prisma.auditLog.create.mockResolvedValue({})
  })

  it('mescla contas e prioriza matrícula ACTIVE', async () => {
    // getMergePreview chama findUnique duas vezes no início
    prisma.profile.findUnique
      .mockReset()
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce(absorbedBase)

    const merge = await mergeProfiles({
      survivorId: 'surv-1',
      absorbedId: 'abs-1',
      keepUsernameFrom: 'absorbed',
      keepPasswordFrom: 'absorbed',
      keepFullNameFrom: 'survivor',
      keepEmailFrom: 'survivor',
      keepPhoneFrom: 'absorbed',
      adminUserId: 'admin-1',
    })

    expect(merge.id).toBe('m1')
    expect(prisma.tx.courseEnrollment.delete).toHaveBeenCalled()
    expect(prisma.tx.courseEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE' },
      })
    )
    expect(prisma.tx.assessment.updateMany).toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('bloqueia se já houver merge aberto', async () => {
    prisma.profile.findUnique
      .mockReset()
      .mockResolvedValueOnce(survivorBase)
      .mockResolvedValueOnce(absorbedBase)
    prisma.profileMerge.findFirst.mockResolvedValueOnce({ id: 'open' })

    await expect(
      mergeProfiles({
        survivorId: 'surv-1',
        absorbedId: 'abs-1',
        keepUsernameFrom: 'survivor',
        keepPasswordFrom: 'survivor',
        keepFullNameFrom: 'survivor',
        keepEmailFrom: 'survivor',
        keepPhoneFrom: 'survivor',
        adminUserId: 'admin-1',
      })
    ).rejects.toThrow(/merge não desfeito/i)
  })

  it('propaga erro da prévia', async () => {
    prisma.profile.findUnique.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    await expect(
      mergeProfiles({
        survivorId: 'x',
        absorbedId: 'y',
        keepUsernameFrom: 'survivor',
        keepPasswordFrom: 'survivor',
        keepFullNameFrom: 'survivor',
        keepEmailFrom: 'survivor',
        keepPhoneFrom: 'survivor',
        adminUserId: 'admin-1',
      })
    ).rejects.toThrow(/não encontrado/i)
  })
})

describe('canUndoMerge / undoMergeProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmptyHistory()
  })

  it('só permite undo sem histórico próprio no absorvido', async () => {
    prisma.profileMerge.findUnique.mockResolvedValueOnce(null)
    expect((await canUndoMerge('m1')).ok).toBe(false)

    prisma.profileMerge.findUnique.mockResolvedValueOnce({
      id: 'm1',
      undone_at: new Date(),
      absorbed_id: 'abs-1',
    })
    expect((await canUndoMerge('m1')).ok).toBe(false)

    prisma.profileMerge.findUnique.mockResolvedValueOnce({
      id: 'm1',
      undone_at: null,
      absorbed_id: 'abs-1',
    })
    prisma.assessment.count.mockResolvedValueOnce(1)
    expect((await canUndoMerge('m1')).ok).toBe(false)

    prisma.profileMerge.findUnique.mockResolvedValueOnce({
      id: 'm1',
      undone_at: null,
      absorbed_id: 'abs-1',
    })
    mockEmptyHistory()
    const ok = await canUndoMerge('m1')
    expect(ok.ok).toBe(true)
  })

  it('desfaz merge e restaura matrículas', async () => {
    const mergeRow = {
      id: 'm1',
      undone_at: null,
      survivor_id: 'surv-1',
      absorbed_id: 'abs-1',
      moved_assessment_ids: '["a1"]',
      moved_certificate_ids: '[]',
      moved_typing_ids: '[]',
      moved_mouse_ids: '[]',
      moved_feedback_ids: '[]',
      moved_release_ids: '[]',
      enrollment_snapshot: JSON.stringify([
        {
          course_id: 'c1',
          survivorBefore: 'PENDING',
          absorbedBefore: 'ACTIVE',
          afterStatus: 'ACTIVE',
        },
        {
          course_id: 'c2',
          survivorBefore: null,
          absorbedBefore: 'ACTIVE',
          afterStatus: 'ACTIVE',
        },
      ]),
      survivor_username_before: 'ana',
      survivor_password_hash_before: 'hash-ana',
      survivor_full_name_before: 'Ana Silva',
      survivor_email_before: 'ana@x.com',
      survivor_phone_before: '',
      absorbed_username_snapshot: 'bia',
      absorbed_password_hash_snapshot: 'hash-bia',
      absorbed_full_name_snapshot: 'Bia Souza',
      absorbed_email_snapshot: '',
      absorbed_phone_snapshot: '11888888888',
    }

    prisma.profileMerge.findUnique.mockResolvedValue(mergeRow)
    mockEmptyHistory()
    prisma.tx.courseEnrollment.findUnique
      .mockResolvedValueOnce({ id: 'cur1' }) // survivor c1
      .mockResolvedValueOnce(null) // absorbed c1
      .mockResolvedValueOnce({ id: 'cur2' }) // survivor c2 (delete)
      .mockResolvedValueOnce(null) // absorbed c2

    await undoMergeProfiles('m1', 'admin-1')

    expect(prisma.tx.assessment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { student_id: 'abs-1' },
      })
    )
    expect(prisma.tx.profileMerge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ undone_by: 'admin-1' }),
      })
    )
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('falha undo quando não permitido', async () => {
    prisma.profileMerge.findUnique.mockResolvedValueOnce(null)
    await expect(undoMergeProfiles('m1', 'admin-1')).rejects.toThrow()
  })
})
