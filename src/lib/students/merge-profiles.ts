import { prisma } from '@/lib/db'

export type MergeIdentitySource = 'survivor' | 'absorbed'

export type MergeProfilesInput = {
  survivorId: string
  absorbedId: string
  keepUsernameFrom: MergeIdentitySource
  keepPasswordFrom: MergeIdentitySource
  keepFullNameFrom: MergeIdentitySource
  keepEmailFrom: MergeIdentitySource
  keepPhoneFrom: MergeIdentitySource
  adminUserId: string
}

function pickBySource<T>(
  source: MergeIdentitySource,
  survivorValue: T,
  absorbedValue: T
): T {
  return source === 'survivor' ? survivorValue : absorbedValue
}

function snapOptional(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : ''
}

type EnrollmentSnap = {
  course_id: string
  survivorBefore: string | null
  absorbedBefore: string | null
  afterStatus: string
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function countOwnHistory(studentId: string) {
  const [assessments, certificates, typing, mouse, feedbacks] = await Promise.all([
    prisma.assessment.count({ where: { student_id: studentId } }),
    prisma.certificate.count({ where: { student_id: studentId } }),
    prisma.typingAttempt.count({ where: { student_id: studentId } }),
    prisma.mouseAccuracyAttempt.count({ where: { student_id: studentId } }),
    prisma.feedback.count({ where: { user_id: studentId } }),
  ])
  return {
    assessments,
    certificates,
    typing,
    mouse,
    feedbacks,
    total: assessments + certificates + typing + mouse + feedbacks,
  }
}

export async function getMergePreview(survivorId: string, absorbedId: string) {
  const [survivor, absorbed] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: survivorId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        deleted_at: true,
        role: true,
      },
    }),
    prisma.profile.findUnique({
      where: { id: absorbedId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        deleted_at: true,
        role: true,
      },
    }),
  ])

  if (!survivor || !absorbed) {
    return { ok: false as const, error: 'Aluno não encontrado' }
  }
  if (survivor.role !== 'STUDENT' || absorbed.role !== 'STUDENT') {
    return { ok: false as const, error: 'Só é possível mesclar contas de alunos' }
  }
  if (survivor.id === absorbed.id) {
    return { ok: false as const, error: 'Selecione dois alunos diferentes' }
  }
  if (survivor.deleted_at) {
    return { ok: false as const, error: 'A conta principal não pode estar excluída' }
  }
  if (absorbed.deleted_at) {
    return { ok: false as const, error: 'A conta a absorver não pode estar excluída' }
  }

  const [survivorHistory, absorbedHistory] = await Promise.all([
    countOwnHistory(survivorId),
    countOwnHistory(absorbedId),
  ])

  return {
    ok: true as const,
    survivor: {
      id: survivor.id,
      username: survivor.username,
      fullName: survivor.full_name,
      email: survivor.email,
      phone: survivor.phone,
      status: survivor.status,
      history: survivorHistory,
    },
    absorbed: {
      id: absorbed.id,
      username: absorbed.username,
      fullName: absorbed.full_name,
      email: absorbed.email,
      phone: absorbed.phone,
      status: absorbed.status,
      history: absorbedHistory,
    },
  }
}

/**
 * Mescla `absorbed` em `survivor`.
 * Mantém histórico de avaliações/exercícios/certificados de ambos em `survivor`.
 * Username/senha escolhidos pelo admin (sem expor a senha).
 */
export async function mergeProfiles(input: MergeProfilesInput) {
  const preview = await getMergePreview(input.survivorId, input.absorbedId)
  if (!preview.ok) {
    const err = new Error(preview.error) as Error & { status?: number }
    err.status = 400
    throw err
  }

  const [survivor, absorbed] = await Promise.all([
    prisma.profile.findUniqueOrThrow({ where: { id: input.survivorId } }),
    prisma.profile.findUniqueOrThrow({ where: { id: input.absorbedId } }),
  ])

  const existingOpen = await prisma.profileMerge.findFirst({
    where: {
      OR: [
        { survivor_id: input.survivorId, undone_at: null },
        { absorbed_id: input.survivorId, undone_at: null },
        { survivor_id: input.absorbedId, undone_at: null },
        { absorbed_id: input.absorbedId, undone_at: null },
      ],
    },
  })
  if (existingOpen) {
    const err = new Error(
      'Uma das contas já participa de um merge não desfeito. Desfaça-o antes.'
    ) as Error & { status?: number }
    err.status = 400
    throw err
  }

  const keepUsername = pickBySource(
    input.keepUsernameFrom,
    survivor.username,
    absorbed.username
  )
  const keepPasswordHash = pickBySource(
    input.keepPasswordFrom,
    survivor.password_hash,
    absorbed.password_hash
  )
  const keepPasswordWeak = pickBySource(
    input.keepPasswordFrom,
    survivor.password_is_weak,
    absorbed.password_is_weak
  )
  const keepPasswordChecked = pickBySource(
    input.keepPasswordFrom,
    survivor.password_strength_checked_at,
    absorbed.password_strength_checked_at
  )
  const keepFullName = pickBySource(
    input.keepFullNameFrom,
    survivor.full_name,
    absorbed.full_name
  )
  const keepEmail = pickBySource(input.keepEmailFrom, survivor.email, absorbed.email)
  const keepPhone = pickBySource(input.keepPhoneFrom, survivor.phone, absorbed.phone)

  const [
    assessmentIds,
    certificateIds,
    typingIds,
    mouseIds,
    feedbackIds,
    releaseIds,
    survivorEnrollments,
    absorbedEnrollments,
  ] = await Promise.all([
    prisma.assessment.findMany({
      where: { student_id: absorbed.id },
      select: { id: true },
    }),
    prisma.certificate.findMany({
      where: { student_id: absorbed.id },
      select: { id: true },
    }),
    prisma.typingAttempt.findMany({
      where: { student_id: absorbed.id },
      select: { id: true },
    }),
    prisma.mouseAccuracyAttempt.findMany({
      where: { student_id: absorbed.id },
      select: { id: true },
    }),
    prisma.feedback.findMany({
      where: { user_id: absorbed.id },
      select: { id: true },
    }),
    prisma.attemptRelease.findMany({
      where: { student_id: absorbed.id },
      select: { id: true },
    }),
    prisma.courseEnrollment.findMany({ where: { student_id: survivor.id } }),
    prisma.courseEnrollment.findMany({ where: { student_id: absorbed.id } }),
  ])

  const rank = (s: string) =>
    s === 'ACTIVE' ? 3 : s === 'PENDING' ? 2 : s === 'INACTIVE' ? 1 : 0

  const enrollmentSnaps: EnrollmentSnap[] = []
  const courseIds = new Set([
    ...survivorEnrollments.map((e) => e.course_id),
    ...absorbedEnrollments.map((e) => e.course_id),
  ])

  const placeholderUsername = `merged_${absorbed.id.slice(0, 12)}_${Date.now().toString(36)}`

  const merge = await prisma.$transaction(async (tx) => {
    // Libera username do absorvido
    await tx.profile.update({
      where: { id: absorbed.id },
      data: {
        username: placeholderUsername,
        session_version: { increment: 1 },
      },
    })

    // Aplica identidade escolhida no sobrevivente
    await tx.profile.update({
      where: { id: survivor.id },
      data: {
        username: keepUsername,
        password_hash: keepPasswordHash,
        password_is_weak: keepPasswordWeak,
        password_strength_checked_at: keepPasswordChecked,
        full_name: keepFullName,
        email: keepEmail,
        phone: keepPhone,
        // Limpa senha temp do sobrevivente; a original escolhida prevalece
        temp_password_hash: null,
        temp_password_expires_at: null,
        session_version: { increment: 1 },
        must_change_password: false,
        status:
          survivor.status === 'APPROVED' || absorbed.status === 'APPROVED'
            ? 'APPROVED'
            : survivor.status,
      },
    })

    if (assessmentIds.length > 0) {
      await tx.assessment.updateMany({
        where: { id: { in: assessmentIds.map((a) => a.id) } },
        data: { student_id: survivor.id },
      })
    }
    if (certificateIds.length > 0) {
      await tx.certificate.updateMany({
        where: { id: { in: certificateIds.map((c) => c.id) } },
        data: { student_id: survivor.id },
      })
    }
    if (typingIds.length > 0) {
      await tx.typingAttempt.updateMany({
        where: { id: { in: typingIds.map((t) => t.id) } },
        data: { student_id: survivor.id },
      })
    }
    if (mouseIds.length > 0) {
      await tx.mouseAccuracyAttempt.updateMany({
        where: { id: { in: mouseIds.map((m) => m.id) } },
        data: { student_id: survivor.id },
      })
    }
    if (feedbackIds.length > 0) {
      await tx.feedback.updateMany({
        where: { id: { in: feedbackIds.map((f) => f.id) } },
        data: { user_id: survivor.id },
      })
    }
    if (releaseIds.length > 0) {
      await tx.attemptRelease.updateMany({
        where: { id: { in: releaseIds.map((r) => r.id) } },
        data: { student_id: survivor.id },
      })
    }

    for (const courseId of courseIds) {
      const s = survivorEnrollments.find((e) => e.course_id === courseId) ?? null
      const a = absorbedEnrollments.find((e) => e.course_id === courseId) ?? null
      const bestStatus =
        rank(s?.status ?? '') >= rank(a?.status ?? '')
          ? s?.status ?? a!.status
          : a!.status

      enrollmentSnaps.push({
        course_id: courseId,
        survivorBefore: s?.status ?? null,
        absorbedBefore: a?.status ?? null,
        afterStatus: bestStatus,
      })

      if (a) {
        await tx.courseEnrollment.delete({ where: { id: a.id } })
      }
      if (s) {
        if (s.status !== bestStatus) {
          await tx.courseEnrollment.update({
            where: { id: s.id },
            data: { status: bestStatus },
          })
        }
      } else {
        await tx.courseEnrollment.create({
          data: {
            student_id: survivor.id,
            course_id: courseId,
            status: bestStatus,
          },
        })
      }
    }

    await tx.profile.update({
      where: { id: absorbed.id },
      data: {
        deleted_at: new Date(),
        status: 'BLOCKED',
        temp_password_hash: null,
        temp_password_expires_at: null,
        session_version: { increment: 1 },
      },
    })

    return tx.profileMerge.create({
      data: {
        survivor_id: survivor.id,
        absorbed_id: absorbed.id,
        keep_username_from: input.keepUsernameFrom,
        keep_password_from: input.keepPasswordFrom,
        keep_full_name_from: input.keepFullNameFrom,
        keep_email_from: input.keepEmailFrom,
        keep_phone_from: input.keepPhoneFrom,
        survivor_username_before: survivor.username,
        survivor_password_hash_before: survivor.password_hash,
        survivor_full_name_before: survivor.full_name,
        survivor_email_before: snapOptional(survivor.email),
        survivor_phone_before: snapOptional(survivor.phone),
        absorbed_username_snapshot: absorbed.username,
        absorbed_password_hash_snapshot: absorbed.password_hash,
        absorbed_full_name_snapshot: absorbed.full_name,
        absorbed_email_snapshot: snapOptional(absorbed.email),
        absorbed_phone_snapshot: snapOptional(absorbed.phone),
        absorbed_placeholder_username: placeholderUsername,
        moved_assessment_ids: JSON.stringify(assessmentIds.map((a) => a.id)),
        moved_certificate_ids: JSON.stringify(certificateIds.map((c) => c.id)),
        moved_typing_ids: JSON.stringify(typingIds.map((t) => t.id)),
        moved_mouse_ids: JSON.stringify(mouseIds.map((m) => m.id)),
        moved_feedback_ids: JSON.stringify(feedbackIds.map((f) => f.id)),
        moved_release_ids: JSON.stringify(releaseIds.map((r) => r.id)),
        enrollment_snapshot: JSON.stringify(enrollmentSnaps),
        created_by: input.adminUserId,
      },
    })
  })

  await prisma.auditLog.create({
    data: {
      user_id: input.adminUserId,
      action: 'MERGE_STUDENTS',
      entity_type: 'PROFILE',
      entity_id: survivor.id,
      metadata: JSON.stringify({
        mergeId: merge.id,
        absorbedId: absorbed.id,
        keepUsernameFrom: input.keepUsernameFrom,
        keepPasswordFrom: input.keepPasswordFrom,
        keepFullNameFrom: input.keepFullNameFrom,
        keepEmailFrom: input.keepEmailFrom,
        keepPhoneFrom: input.keepPhoneFrom,
        movedAssessments: assessmentIds.length,
      }),
    },
  })

  return merge
}

export async function canUndoMerge(mergeId: string) {
  const merge = await prisma.profileMerge.findUnique({ where: { id: mergeId } })
  if (!merge || merge.undone_at) {
    return { ok: false as const, error: 'Merge não encontrado ou já desfeito' }
  }

  // Só desfaz se o absorvido não tiver histórico próprio (ainda vazio).
  const history = await countOwnHistory(merge.absorbed_id)
  if (history.total > 0) {
    return {
      ok: false as const,
      error:
        'Não é possível desfazer: a conta absorvida já possui histórico próprio.',
    }
  }

  return { ok: true as const, merge, history }
}

export async function undoMergeProfiles(mergeId: string, adminUserId: string) {
  const check = await canUndoMerge(mergeId)
  if (!check.ok) {
    const err = new Error(check.error) as Error & { status?: number }
    err.status = 400
    throw err
  }

  const merge = check.merge
  const assessmentIds = parseJsonArray(merge.moved_assessment_ids)
  const certificateIds = parseJsonArray(merge.moved_certificate_ids)
  const typingIds = parseJsonArray(merge.moved_typing_ids)
  const mouseIds = parseJsonArray(merge.moved_mouse_ids)
  const feedbackIds = parseJsonArray(merge.moved_feedback_ids)
  const releaseIds = parseJsonArray(merge.moved_release_ids)
  let enrollmentSnaps: EnrollmentSnap[] = []
  try {
    const parsed = JSON.parse(merge.enrollment_snapshot || '[]')
    if (Array.isArray(parsed)) enrollmentSnaps = parsed as EnrollmentSnap[]
  } catch {
    enrollmentSnaps = []
  }

  // Placeholder temporário se o username original do absorvido conflitar
  const tempSurvivor =
    `tmp_surv_${merge.survivor_id.slice(0, 10)}_${Date.now().toString(36)}`

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id: merge.survivor_id },
      data: { username: tempSurvivor },
    })

    await tx.profile.update({
      where: { id: merge.absorbed_id },
      data: {
        username: merge.absorbed_username_snapshot,
        password_hash: merge.absorbed_password_hash_snapshot,
        full_name: merge.absorbed_full_name_snapshot,
        email: merge.absorbed_email_snapshot || null,
        phone: merge.absorbed_phone_snapshot || null,
        deleted_at: null,
        status: 'APPROVED',
        session_version: { increment: 1 },
      },
    })

    await tx.profile.update({
      where: { id: merge.survivor_id },
      data: {
        username: merge.survivor_username_before,
        password_hash: merge.survivor_password_hash_before,
        full_name: merge.survivor_full_name_before || merge.survivor_username_before,
        email: merge.survivor_email_before || null,
        phone: merge.survivor_phone_before || null,
        session_version: { increment: 1 },
        temp_password_hash: null,
        temp_password_expires_at: null,
      },
    })

    if (assessmentIds.length > 0) {
      await tx.assessment.updateMany({
        where: { id: { in: assessmentIds } },
        data: { student_id: merge.absorbed_id },
      })
    }
    if (certificateIds.length > 0) {
      await tx.certificate.updateMany({
        where: { id: { in: certificateIds } },
        data: { student_id: merge.absorbed_id },
      })
    }
    if (typingIds.length > 0) {
      await tx.typingAttempt.updateMany({
        where: { id: { in: typingIds } },
        data: { student_id: merge.absorbed_id },
      })
    }
    if (mouseIds.length > 0) {
      await tx.mouseAccuracyAttempt.updateMany({
        where: { id: { in: mouseIds } },
        data: { student_id: merge.absorbed_id },
      })
    }
    if (feedbackIds.length > 0) {
      await tx.feedback.updateMany({
        where: { id: { in: feedbackIds } },
        data: { user_id: merge.absorbed_id },
      })
    }
    if (releaseIds.length > 0) {
      await tx.attemptRelease.updateMany({
        where: { id: { in: releaseIds } },
        data: { student_id: merge.absorbed_id },
      })
    }

    for (const snap of enrollmentSnaps) {
      const current = await tx.courseEnrollment.findUnique({
        where: {
          student_id_course_id: {
            student_id: merge.survivor_id,
            course_id: snap.course_id,
          },
        },
      })

      if (snap.survivorBefore == null) {
        if (current) {
          await tx.courseEnrollment.delete({ where: { id: current.id } })
        }
      } else if (current) {
        await tx.courseEnrollment.update({
          where: { id: current.id },
          data: { status: snap.survivorBefore },
        })
      } else {
        await tx.courseEnrollment.create({
          data: {
            student_id: merge.survivor_id,
            course_id: snap.course_id,
            status: snap.survivorBefore,
          },
        })
      }

      if (snap.absorbedBefore != null) {
        const existingAbs = await tx.courseEnrollment.findUnique({
          where: {
            student_id_course_id: {
              student_id: merge.absorbed_id,
              course_id: snap.course_id,
            },
          },
        })
        if (existingAbs) {
          await tx.courseEnrollment.update({
            where: { id: existingAbs.id },
            data: { status: snap.absorbedBefore },
          })
        } else {
          await tx.courseEnrollment.create({
            data: {
              student_id: merge.absorbed_id,
              course_id: snap.course_id,
              status: snap.absorbedBefore,
            },
          })
        }
      }
    }

    await tx.profileMerge.update({
      where: { id: merge.id },
      data: {
        undone_at: new Date(),
        undone_by: adminUserId,
      },
    })
  })

  await prisma.auditLog.create({
    data: {
      user_id: adminUserId,
      action: 'UNDO_MERGE_STUDENTS',
      entity_type: 'PROFILE',
      entity_id: merge.survivor_id,
      metadata: JSON.stringify({
        mergeId: merge.id,
        absorbedId: merge.absorbed_id,
      }),
    },
  })

  return merge
}
