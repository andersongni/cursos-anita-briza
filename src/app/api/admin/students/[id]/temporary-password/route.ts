import { randomInt } from 'crypto'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  TEMP_PASSWORD_HOURS,
  isTempPasswordActive,
  tempPasswordExpiresAt,
} from '@/lib/auth/temporary-password'

function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(chars.length)]
  }
  return out
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    const { id } = await params
    const student = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        temp_password_hash: true,
        temp_password_expires_at: true,
      },
    })
    if (!student || student.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const active = Boolean(
      student.temp_password_hash &&
        isTempPasswordActive(student.temp_password_expires_at)
    )

    return NextResponse.json({
      active,
      expiresAt: active ? student.temp_password_expires_at : null,
      hours: TEMP_PASSWORD_HOURS,
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao consultar senha temporária' },
      { status: err.status || 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAdmin()
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const student = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        full_name: true,
        deleted_at: true,
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }
    if (student.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'Só é possível definir senha temporária para alunos' },
        { status: 400 }
      )
    }
    if (student.deleted_at) {
      return NextResponse.json(
        { error: 'Restaure o aluno antes de definir senha temporária' },
        { status: 400 }
      )
    }

    let password =
      typeof body.password === 'string' ? body.password.trim() : ''

    // Senha temporária pode ser fraca de propósito (suporte pontual).
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'A senha temporária deve ter pelo menos 6 caracteres' },
          { status: 400 }
        )
      }
    } else {
      password = generateTempPassword(10)
    }

    const expiresAt = tempPasswordExpiresAt()
    const temp_password_hash = await bcrypt.hash(password, 12)

    await prisma.profile.update({
      where: { id: student.id },
      data: {
        temp_password_hash,
        temp_password_expires_at: expiresAt,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'SET_TEMP_PASSWORD',
        entity_type: 'PROFILE',
        entity_id: student.id,
        metadata: JSON.stringify({
          username: student.username,
          expiresAt: expiresAt.toISOString(),
          hours: TEMP_PASSWORD_HOURS,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      username: student.username,
      temporary_password: password,
      expiresAt: expiresAt.toISOString(),
      hours: TEMP_PASSWORD_HOURS,
    })
  } catch (error: unknown) {
    console.error('Set temporary password error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao definir senha temporária' },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAdmin()
    const { id } = await params

    const student = await prisma.profile.findUnique({
      where: { id },
      select: { id: true, username: true, role: true },
    })
    if (!student || student.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    await prisma.profile.update({
      where: { id: student.id },
      data: {
        temp_password_hash: null,
        temp_password_expires_at: null,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'CLEAR_TEMP_PASSWORD',
        entity_type: 'PROFILE',
        entity_id: student.id,
        metadata: JSON.stringify({ username: student.username }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao revogar senha temporária' },
      { status: err.status || 500 }
    )
  }
}
