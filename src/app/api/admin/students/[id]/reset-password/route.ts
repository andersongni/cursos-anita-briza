import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { isWeakPassword } from '@/lib/auth/weak-password'
import {
  checkPasswordComplexity,
  generateStrongPassword,
} from '@/lib/auth/strong-password'

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
      select: { id: true, username: true, role: true, full_name: true, deleted_at: true },
    })

    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    if (student.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'Só é possível resetar senha de alunos por esta tela' },
        { status: 400 }
      )
    }

    if (student.deleted_at) {
      return NextResponse.json(
        { error: 'Restaure o aluno antes de resetar a senha' },
        { status: 400 }
      )
    }

    let newPassword =
      typeof body.new_password === 'string' ? body.new_password.trim() : ''

    if (newPassword) {
      const complexity = checkPasswordComplexity(newPassword)
      if (!complexity.ok) {
        return NextResponse.json({ error: complexity.error }, { status: 400 })
      }
      if (isWeakPassword(newPassword, { username: student.username })) {
        return NextResponse.json(
          {
            error:
              'Senha muito fraca (ex.: 123456). Escolha outra ou deixe em branco para gerar automaticamente.',
          },
          { status: 400 }
        )
      }
    } else {
      newPassword = generateStrongPassword(10)
      while (isWeakPassword(newPassword, { username: student.username })) {
        newPassword = generateStrongPassword(10)
      }
    }

    const password_hash = await bcrypt.hash(newPassword, 12)

    // Nova senha + invalida sessões JWT ativas do aluno
    await prisma.profile.update({
      where: { id: student.id },
      data: {
        password_hash,
        session_version: { increment: 1 },
        password_is_weak: false,
        password_strength_checked_at: new Date(),
        // Senha definida pelo admin é definitiva — não força troca no login.
        must_change_password: false,
        // Reset definitivo invalida também a senha temporária.
        temp_password_hash: null,
        temp_password_expires_at: null,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'RESET_STUDENT_PASSWORD',
        entity_type: 'PROFILE',
        entity_id: student.id,
        metadata: JSON.stringify({ username: student.username }),
      },
    })

    return NextResponse.json({
      success: true,
      username: student.username,
      temporary_password: newPassword,
    })
  } catch (error: unknown) {
    console.error('Reset student password error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao resetar senha' },
      { status: err.status || 500 }
    )
  }
}
