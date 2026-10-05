import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { assertAdminTypingExerciseAccess } from '@/lib/courses'
import { normalizePassageContent } from '@/lib/exercises/typing'
import { ensureTypingPassagesSeeded } from '@/lib/exercises/ensure-typing-passages'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    await assertAdminTypingExerciseAccess()
    await ensureTypingPassagesSeeded()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()

    const passages = await prisma.typingPassage.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q } },
              { content: { contains: q } },
            ],
          }
        : undefined,
      orderBy: [{ updated_at: 'desc' }],
      include: {
        _count: { select: { attempts: true } },
      },
    })

    return NextResponse.json({
      passages: passages.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        active: p.active,
        attempts: p._count.attempts,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao listar textos'
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    await assertAdminTypingExerciseAccess()
    const body = await req.json()

    // Atalho: carregar/reativar textos padrão
    if (body?.action === 'seed-defaults') {
      const result = await ensureTypingPassagesSeeded({ force: true })
      const passages = await prisma.typingPassage.findMany({
        orderBy: [{ updated_at: 'desc' }],
        include: { _count: { select: { attempts: true } } },
      })
      return NextResponse.json({
        success: true,
        seed: result,
        passages: passages.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          active: p.active,
          attempts: p._count.attempts,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })),
      })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content =
      typeof body.content === 'string' ? normalizePassageContent(body.content) : ''
    const active = body.active !== false

    if (!title || title.length < 3) {
      return NextResponse.json({ error: 'Informe um título com pelo menos 3 caracteres' }, { status: 400 })
    }
    if (!content || content.length < 40) {
      return NextResponse.json(
        { error: 'O texto precisa ter pelo menos 40 caracteres' },
        { status: 400 }
      )
    }

    const passage = await prisma.typingPassage.create({
      data: { title, content, active },
    })

    return NextResponse.json({ passage }, { status: 201 })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao criar texto'
    return NextResponse.json({ error: message }, { status })
  }
}
