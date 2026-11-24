import { prisma } from '@/lib/db'
import { formatFullName, generateCertificateCode } from '@/lib/utils'

export type IssuedCertificate = {
  id: string
  student_id: string
  course_id: string
  assessment_id: string
  certificate_code: string
  student_name_snapshot: string
  course_name_snapshot: string
  completion_date: Date
  score_snapshot: number | null
  created_at: Date
}

export type IssueCertificateResult =
  | { ok: true; created: boolean; certificate: IssuedCertificate }
  | { ok: false; reason: string }

/**
 * Emite certificado para prova oficial aprovada (COMPLETED + passed).
 * Idempotente: se já existir, devolve o existente.
 */
export async function issueCertificateForAssessment(
  assessmentId: string
): Promise<IssueCertificateResult> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      student: { select: { id: true, full_name: true } },
      course: { select: { id: true, name: true } },
      certificate: true,
    },
  })

  if (!assessment) {
    return { ok: false, reason: 'Avaliação não encontrada' }
  }

  if (assessment.type !== 'PROVA') {
    return { ok: false, reason: 'Somente provas oficiais geram certificado' }
  }

  if (assessment.status !== 'COMPLETED' || !assessment.passed) {
    return { ok: false, reason: 'Avaliação não elegível para certificado' }
  }

  if (assessment.certificate) {
    return {
      ok: true,
      created: false,
      certificate: assessment.certificate as IssuedCertificate,
    }
  }

  const courseName = assessment.course?.name || 'Curso'
  const certificate = await prisma.certificate.create({
    data: {
      student_id: assessment.student_id,
      course_id: assessment.course_id,
      assessment_id: assessment.id,
      certificate_code: generateCertificateCode(),
      student_name_snapshot: formatFullName(assessment.student.full_name),
      course_name_snapshot: courseName,
      completion_date: assessment.completed_at || new Date(),
      score_snapshot: assessment.score ?? 0,
    },
  })

  return {
    ok: true,
    created: true,
    certificate: certificate as IssuedCertificate,
  }
}

/**
 * Garante certificado para prova aprovada. Erros são logados e não interrompem
 * a finalização da avaliação.
 */
export async function ensureCertificateForPassedProva(
  assessmentId: string
): Promise<IssuedCertificate | null> {
  try {
    const result = await issueCertificateForAssessment(assessmentId)
    if (!result.ok) return null
    return result.certificate
  } catch (err) {
    console.error(
      '[certificate] falha ao emitir certificado automático',
      assessmentId,
      err
    )
    return null
  }
}

/**
 * Emite certificados pendentes de provas aprovadas (backfill).
 * Sem `studentId`, cobre todos os alunos.
 */
export async function issuePendingCertificatesForStudent(
  studentId?: string
): Promise<number> {
  const pending = await prisma.assessment.findMany({
    where: {
      ...(studentId ? { student_id: studentId } : {}),
      type: 'PROVA',
      status: 'COMPLETED',
      passed: true,
      certificate: null,
    },
    select: { id: true },
    orderBy: { completed_at: 'asc' },
  })

  let created = 0
  for (const row of pending) {
    const result = await issueCertificateForAssessment(row.id)
    if (result.ok && result.created) created += 1
  }
  return created
}
