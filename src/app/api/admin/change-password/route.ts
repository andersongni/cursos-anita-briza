import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function POST(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const { current_password, new_password, confirm_password } = body

    if (!current_password || !new_password || !confirm_password) {
      return NextResponse.json(
        { error: 'Preencha todos os campos' },
        { status: 400 }
      )
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    if (new_password !== confirm_password) {
      return NextResponse.json(
        { error: 'A confirmação não coincide com a nova senha' },
        { status: 400 }
      )
    }

    if (current_password === new_password) {
      return NextResponse.json(
        { error: 'A nova senha deve ser diferente da atual' },
        { status: 400 }
      )
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, password_hash: true },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const valid = await bcrypt.compare(current_password, profile.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 })
    }

    const password_hash = await bcrypt.hash(new_password, 12)

    await prisma.profile.update({
      where: { id: profile.id },
      data: { password_hash },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'CHANGE_PASSWORD',
        entity_type: 'PROFILE',
        entity_id: user.id,
        metadata: JSON.stringify({ by: 'self' }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao alterar senha' },
      { status: error.status || 500 }
    )
  }
}
