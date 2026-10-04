import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isValidUsername } from '@/lib/utils'

/** Verifica se o nome de usuário está disponível para cadastro. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const username = (searchParams.get('username') || '').trim().toLowerCase()

    if (!username) {
      return NextResponse.json({ available: false, error: 'Usuário é obrigatório' }, { status: 400 })
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          available: false,
          error: 'Use apenas letras minúsculas, números e pontos',
        },
        { status: 400 }
      )
    }

    const existing = await prisma.profile.findUnique({
      where: { username },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ available: false, error: 'Este nome de usuário já está em uso' })
    }

    return NextResponse.json({ available: true })
  } catch (error) {
    console.error('Check username error:', error)
    return NextResponse.json({ error: 'Erro ao verificar usuário' }, { status: 500 })
  }
}
