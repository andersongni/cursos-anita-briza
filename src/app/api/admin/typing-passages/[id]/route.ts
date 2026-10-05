import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { assertAdminTypingExerciseAccess } from '@/lib/courses'
import { normalizePassageContent } from '@/lib/exercises/typing'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    await verifyAdmin()
    await assertAdminTypingExerciseAccess()
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.typingPassage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Texto não encontrado' }, { status: 404 })
    }

    const data: { title?: string; content?: string; active?: boolean } = {}

    if (typeof body.title === 'string') {
      const title = body.title.trim()
      if (title.length < 3) {
        return NextResponse.json(
          { error: 'Informe um título com pelo menos 3 caracteres' },
          { status: 400 }
        )
      }
      data.title = title
    }

    if (typeof body.content === 'string') {
      const content = normalizePassageContent(body.content)
      if (content.length < 40) {
        return NextResponse.json(
          { error: 'O texto precisa ter pelo menos 40 caracteres' },
          { status: 400 }
        )
      }
      data.content = content
    }

    if (typeof body.active === 'boolean') {
      data.active = body.active
    }

    const passage = await prisma.typingPassage.update({
      where: { id },
      data,
    })

    return NextResponse.json({ passage })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao atualizar texto'
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    await verifyAdmin()
    await assertAdminTypingExerciseAccess()
    const { id } = await params

    const existing = await prisma.typingPassage.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Texto não encontrado' }, { status: 404 })
    }

    if (existing._count.attempts > 0) {
      // Preserva histórico: desativa em vez de apagar
      const passage = await prisma.typingPassage.update({
        where: { id },
        data: { active: false },
      })
      return NextResponse.json({
        passage,
        deactivated: true,
        message: 'Texto desativado porque já possui tentativas registradas.',
      })
    }

    await prisma.typingPassage.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao excluir texto'
    return NextResponse.json({ error: message }, { status })
  }
}
