import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET() {
  try {
    await verifyAdmin()
    const dimensions = await prisma.dimension.findMany({
      orderBy: { display_order: 'asc' },
    })
    return NextResponse.json({ dimensions })
  } catch (error: unknown) {
    console.error('Error fetching dimensions:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

/** Percentual inteiro de 0 a 100 (sem casas decimais). */
function parsePercentage(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) return null
  return n
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const { name, description, weight, target_percentage, display_order } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome do tema é obrigatório' }, { status: 400 })
    }

    const pct = parsePercentage(target_percentage)
    if (target_percentage !== undefined && pct === null) {
      return NextResponse.json(
        { error: 'Percentual deve ser um número inteiro entre 0 e 100' },
        { status: 400 }
      )
    }

    const dimension = await prisma.dimension.create({
      data: {
        name: name.trim(),
        description,
        weight,
        target_percentage: pct ?? 0,
        display_order,
      },
    })

    return NextResponse.json({ dimension })
  } catch (error: unknown) {
    console.error('Error creating dimension:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()

    // Salvamento em lote da distribuição (exige soma 100% nos temas ativos)
    if (Array.isArray(body.distributions)) {
      const updates: { id: string; target_percentage: number }[] = []
      for (const item of body.distributions) {
        if (!item || typeof item.id !== 'string') {
          return NextResponse.json({ error: 'Item de distribuição inválido' }, { status: 400 })
        }
        const pct = parsePercentage(item.target_percentage)
        if (pct === null) {
          return NextResponse.json(
            { error: 'Percentual deve ser um número inteiro entre 0 e 100' },
            { status: 400 }
          )
        }
        updates.push({ id: item.id, target_percentage: pct })
      }

      const all = await prisma.dimension.findMany({
        select: { id: true, active: true, target_percentage: true },
      })
      const pctById = new Map(all.map((d) => [d.id, d.target_percentage]))
      for (const u of updates) {
        if (!pctById.has(u.id)) {
          return NextResponse.json({ error: `Tema não encontrado: ${u.id}` }, { status: 404 })
        }
        pctById.set(u.id, u.target_percentage)
      }

      const activeSum = all
        .filter((d) => d.active)
        .reduce((s, d) => s + (pctById.get(d.id) ?? 0), 0)

      if (activeSum !== 100) {
        return NextResponse.json(
          {
            error: `A soma dos percentuais dos temas ativos deve ser 100% (atual: ${activeSum}%).`,
          },
          { status: 400 }
        )
      }

      await prisma.$transaction(
        updates.map((u) =>
          prisma.dimension.update({
            where: { id: u.id },
            data: { target_percentage: u.target_percentage },
          })
        )
      )

      const dimensions = await prisma.dimension.findMany({
        orderBy: { display_order: 'asc' },
      })
      return NextResponse.json({ success: true, dimensions })
    }

    const { id, name, description, weight, target_percentage, display_order, active } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing dimension id' }, { status: 400 })
    }

    // Percentual individual só via lote (distributions) — evita salvar soma != 100
    if (target_percentage !== undefined) {
      return NextResponse.json(
        {
          error:
            'Salve a distribuição completa quando a soma dos temas ativos for 100%.',
        },
        { status: 400 }
      )
    }

    const data: {
      name?: string
      description?: string | null
      weight?: number
      display_order?: number
      active?: boolean
    } = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (weight !== undefined) data.weight = weight
    if (display_order !== undefined) data.display_order = display_order
    if (active !== undefined) data.active = active

    const dimension = await prisma.dimension.update({
      where: { id },
      data,
    })

    return NextResponse.json({ dimension })
  } catch (error: unknown) {
    console.error('Error updating dimension:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json().catch(() => ({}))
    const id = body.id || new URL(req.url).searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing dimension id' }, { status: 400 })
    }

    const activeQuestionsCount = await prisma.question.count({
      where: { dimension_id: id, active: true },
    })

    if (activeQuestionsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete dimension with active questions' },
        { status: 400 }
      )
    }

    await prisma.dimension.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting dimension:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
