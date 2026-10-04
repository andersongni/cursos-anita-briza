import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { notDeleted } from '@/lib/students/soft-delete'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const deleted = searchParams.get('deleted') // 'only' | 'include' | default active only

    const where: Record<string, unknown> = { role: 'STUDENT' }
    if (deleted === 'only') {
      where.deleted_at = { not: null }
    } else if (deleted !== 'include') {
      Object.assign(where, notDeleted)
    }
    if (status) {
      where.status = status
    }

    const profiles = await prisma.profile.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        deleted_at: true,
        created_at: true,
        last_login_at: true,
      },
    })

    return NextResponse.json({ profiles })
  } catch (error: unknown) {
    console.error('Error fetching students:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const { id, status, action } = body as {
      id?: string
      status?: string
      action?: 'DELETE' | 'RESTORE'
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const existing = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        deleted_at: true,
        full_name: true,
      },
    })

    if (!existing || existing.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    if (action === 'DELETE') {
      if (existing.deleted_at) {
        return NextResponse.json({ error: 'Aluno já está excluído' }, { status: 400 })
      }

      const updatedProfile = await prisma.profile.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          session_version: { increment: 1 },
        },
      })

      await prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: 'SOFT_DELETE_STUDENT',
          entity_type: 'PROFILE',
          entity_id: id,
          metadata: JSON.stringify({ previous_status: existing.status }),
        },
      })

      return NextResponse.json({ profile: updatedProfile })
    }

    if (action === 'RESTORE') {
      if (!existing.deleted_at) {
        return NextResponse.json({ error: 'Aluno não está excluído' }, { status: 400 })
      }

      const updatedProfile = await prisma.profile.update({
        where: { id },
        data: { deleted_at: null },
      })

      await prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: 'RESTORE_STUDENT',
          entity_type: 'PROFILE',
          entity_id: id,
          metadata: JSON.stringify({ status: existing.status }),
        },
      })

      return NextResponse.json({ profile: updatedProfile })
    }

    if (!status) {
      return NextResponse.json({ error: 'Missing status or action' }, { status: 400 })
    }

    if (existing.deleted_at) {
      return NextResponse.json(
        { error: 'Restaure o aluno antes de alterar o status' },
        { status: 400 }
      )
    }

    const updatedProfile = await prisma.profile.update({
      where: { id },
      data: { status },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'UPDATE_STUDENT_STATUS',
        entity_type: 'PROFILE',
        entity_id: id,
        metadata: JSON.stringify({ status }),
      },
    })

    return NextResponse.json({ profile: updatedProfile })
  } catch (error: unknown) {
    console.error('Error updating student:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
