import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { ensureCourses, listActiveCourses } from '@/lib/courses'
import {
  TEMP_PASSWORD_HOURS,
  isTempPasswordActive,
} from '@/lib/auth/temporary-password'
import { canUndoMerge } from '@/lib/students/merge-profiles'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    await ensureCourses()
    const { id } = await params

    const profile = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        deleted_at: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        temp_password_hash: true,
        temp_password_expires_at: true,
      },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Perfil não é de aluno' }, { status: 400 })
    }

    const [
      assessments,
      certificates,
      enrollments,
      courses,
      openMerge,
      typingAttempts,
      mouseAccuracyAttempts,
    ] = await Promise.all([
      prisma.assessment.findMany({
        where: { student_id: id },
        include: { course: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.certificate.findMany({
        where: { student_id: id },
        orderBy: { created_at: 'desc' },
      }),
      prisma.courseEnrollment.findMany({
        where: { student_id: id },
        select: {
          id: true,
          course_id: true,
          status: true,
          enrolled_at: true,
          course: { select: { id: true, name: true, slug: true } },
        },
      }),
      listActiveCourses(),
      prisma.profileMerge.findFirst({
        where: {
          undone_at: null,
          OR: [{ survivor_id: id }, { absorbed_id: id }],
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          survivor_id: true,
          absorbed_id: true,
          keep_username_from: true,
          keep_password_from: true,
          absorbed_username_snapshot: true,
          absorbed_full_name_snapshot: true,
          created_at: true,
          absorbed: {
            select: {
              id: true,
              deleted_at: true,
            },
          },
          survivor: {
            select: {
              id: true,
              username: true,
              full_name: true,
            },
          },
        },
      }),
      prisma.typingAttempt.findMany({
        where: { student_id: id },
        select: {
          id: true,
          duration_ms: true,
          error_count: true,
          wpm: true,
          accuracy: true,
          score: true,
          completed_at: true,
          passage: { select: { id: true, title: true } },
        },
        orderBy: { completed_at: 'desc' },
      }),
      prisma.mouseAccuracyAttempt.findMany({
        where: { student_id: id },
        select: {
          id: true,
          duration_ms: true,
          hits: true,
          misses: true,
          expired: true,
          points: true,
          accuracy: true,
          score: true,
          max_combo: true,
          avg_reaction_ms: true,
          completed_at: true,
        },
        orderBy: { completed_at: 'desc' },
      }),
    ])

    const tempActive = Boolean(
      profile.temp_password_hash &&
        isTempPasswordActive(profile.temp_password_expires_at)
    )

    const {
      temp_password_hash: _hash,
      temp_password_expires_at,
      ...safeProfile
    } = profile

    let mergeInfo: {
      id: string
      role: 'survivor' | 'absorbed'
      canUndo: boolean
      undoError: string | null
      other: { id: string; username: string; fullName: string }
      createdAt: string
    } | null = null

    if (openMerge) {
      const undoCheck = await canUndoMerge(openMerge.id)
      const isSurvivor = openMerge.survivor_id === id
      mergeInfo = {
        id: openMerge.id,
        role: isSurvivor ? 'survivor' : 'absorbed',
        canUndo: undoCheck.ok,
        undoError: undoCheck.ok ? null : undoCheck.error,
        other: isSurvivor
          ? {
              id: openMerge.absorbed.id,
              // Username placeholder pós-merge (merged_…) não deve aparecer na UI
              username: openMerge.absorbed_username_snapshot,
              fullName: openMerge.absorbed_full_name_snapshot,
            }
          : {
              id: openMerge.survivor.id,
              username: openMerge.survivor.username,
              fullName: openMerge.survivor.full_name,
            },
        createdAt: openMerge.created_at.toISOString(),
      }
    }

    return NextResponse.json({
      profile: {
        ...safeProfile,
        assessments,
        certificates,
        enrollments,
        typingAttempts,
        mouseAccuracyAttempts,
        temporaryPassword: {
          active: tempActive,
          expiresAt: tempActive ? temp_password_expires_at : null,
          hours: TEMP_PASSWORD_HOURS,
        },
        openMerge: mergeInfo,
      },
      courses,
    })
  } catch (error: unknown) {
    console.error('Error fetching student detail:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
