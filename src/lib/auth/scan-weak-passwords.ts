import { prisma } from '@/lib/db'
import { hashMatchesWeakPassword } from '@/lib/auth/weak-password'

const SCAN_BATCH = 20

/**
 * Marca alunos com senha fraca ainda não verificados (backfill).
 * Compara hashes com a lista comum; limita o lote por chamada.
 */
export async function scanAndFlagWeakStudentPasswords(opts?: {
  courseId?: string | null
  limit?: number
}): Promise<{ scanned: number; flagged: number }> {
  const limit = Math.max(1, Math.min(opts?.limit ?? SCAN_BATCH, 40))
  const now = new Date()

  const students = await prisma.profile.findMany({
    where: {
      role: 'STUDENT',
      deleted_at: null,
      password_strength_checked_at: null,
      ...(opts?.courseId
        ? {
            enrollments: {
              some: { course_id: opts.courseId, status: 'ACTIVE' as const },
            },
          }
        : {}),
    },
    select: { id: true, password_hash: true },
    take: limit,
    orderBy: { created_at: 'asc' },
  })

  let flagged = 0
  for (const student of students) {
    const weak = await hashMatchesWeakPassword(student.password_hash)
    await prisma.profile.update({
      where: { id: student.id },
      data: {
        password_is_weak: weak,
        password_strength_checked_at: now,
      },
    })
    if (weak) flagged += 1
  }

  return { scanned: students.length, flagged }
}
