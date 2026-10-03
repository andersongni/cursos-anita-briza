import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

function generateTempPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
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
      select: { id: true, username: true, role: true, full_name: true },
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

    let newPassword =
      typeof body.new_password === 'string' ? body.new_password.trim() : ''

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'A senha deve ter pelo menos 6 caracteres' },
          { status: 400 }
        )
      }
    } else {
      newPassword = generateTempPassword(8)
    }

    const password_hash = await bcrypt.hash(newPassword, 12)

    // Nova senha + invalida sessões JWT ativas do aluno
    await prisma.profile.update({
      where: { id: student.id },
      data: {
        password_hash,
        session_version: { increment: 1 },
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
  } catch (error: any) {
    console.error('Reset student password error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao resetar senha' },
      { status: error.status || 500 }
    )
  }
}
