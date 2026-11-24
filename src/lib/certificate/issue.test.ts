import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  assessment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  certificate: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/utils', () => ({
  formatFullName: (n: string) => n,
  generateCertificateCode: () => 'AAAA-BBBB-CCCC',
}))

import {
  issueCertificateForAssessment,
  issuePendingCertificatesForStudent,
} from './issue'

describe('issueCertificateForAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recusa avaliação inexistente', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce(null)
    const result = await issueCertificateForAssessment('x')
    expect(result).toEqual({ ok: false, reason: 'Avaliação não encontrada' })
  })

  it('recusa simulado', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce({
      id: 'a1',
      type: 'SIMULADO',
      status: 'COMPLETED',
      passed: true,
      certificate: null,
    })
    const result = await issueCertificateForAssessment('a1')
    expect(result.ok).toBe(false)
  })

  it('cria certificado para prova aprovada', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce({
      id: 'a1',
      type: 'PROVA',
      status: 'COMPLETED',
      passed: true,
      student_id: 's1',
      course_id: 'c1',
      score: 90,
      completed_at: new Date('2026-01-01'),
      student: { id: 's1', full_name: 'Ana' },
      course: { id: 'c1', name: 'Informática' },
      certificate: null,
    })
    const created = {
      id: 'cert1',
      assessment_id: 'a1',
      certificate_code: 'AAAA-BBBB-CCCC',
    }
    prisma.certificate.create.mockResolvedValueOnce(created)

    const result = await issueCertificateForAssessment('a1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.certificate.id).toBe('cert1')
    }
    expect(prisma.certificate.create).toHaveBeenCalled()
  })

  it('é idempotente quando já existe', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce({
      id: 'a1',
      type: 'PROVA',
      status: 'COMPLETED',
      passed: true,
      certificate: { id: 'cert-old', assessment_id: 'a1' },
      student: { id: 's1', full_name: 'Ana' },
      course: { id: 'c1', name: 'Informática' },
    })
    const result = await issueCertificateForAssessment('a1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(false)
      expect(result.certificate.id).toBe('cert-old')
    }
    expect(prisma.certificate.create).not.toHaveBeenCalled()
  })
})

describe('issuePendingCertificatesForStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emite pendentes em lote', async () => {
    prisma.assessment.findMany.mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }])
    prisma.assessment.findUnique
      .mockResolvedValueOnce({
        id: 'a1',
        type: 'PROVA',
        status: 'COMPLETED',
        passed: true,
        student_id: 's1',
        course_id: 'c1',
        score: 80,
        completed_at: new Date(),
        student: { id: 's1', full_name: 'Ana' },
        course: { id: 'c1', name: 'Curso' },
        certificate: null,
      })
      .mockResolvedValueOnce({
        id: 'a2',
        type: 'PROVA',
        status: 'COMPLETED',
        passed: true,
        student_id: 's2',
        course_id: 'c1',
        score: 85,
        completed_at: new Date(),
        student: { id: 's2', full_name: 'Bia' },
        course: { id: 'c1', name: 'Curso' },
        certificate: null,
      })
    prisma.certificate.create
      .mockResolvedValueOnce({ id: 'c1' })
      .mockResolvedValueOnce({ id: 'c2' })

    const created = await issuePendingCertificatesForStudent()
    expect(created).toBe(2)
  })
})
