import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { ensureTypingPassagesSeeded } from '@/lib/exercises/ensure-typing-passages'

/** Sorteia um texto ativo para a prática de digitação. */
export async function GET() {
  try {
    const { profile } = await verifyAuth()
    if (profile.role !== 'STUDENT' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (profile.status !== 'APPROVED' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Conta não aprovada' }, { status: 403 })
    }

    await ensureTypingPassagesSeeded({ force: true })

    const passages = await prisma.typingPassage.findMany({
      where: { active: true },
      select: { id: true, title: true, content: true },
    })

    if (passages.length === 0) {
      return NextResponse.json(
        {
          error:
            'Nenhum texto de digitação disponível. No admin, abra Exercícios e clique em “Carregar textos padrão”.',
        },
        { status: 404 }
      )
    }

    const passage = passages[Math.floor(Math.random() * passages.length)]
    return NextResponse.json({
      passage: {
        id: passage.id,
        title: passage.title,
        content: passage.content,
        charCount: passage.content.length,
      },
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao iniciar exercício'
    return NextResponse.json({ error: message }, { status })
  }
}
