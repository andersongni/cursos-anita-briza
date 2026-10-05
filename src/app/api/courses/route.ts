import { NextResponse } from 'next/server'
import { ensureCourses, listActiveCourses } from '@/lib/courses'

export const runtime = 'nodejs'

/** Lista pública de cursos ativos (cadastro / solicitação). */
export async function GET() {
  try {
    await ensureCourses()
    const courses = await listActiveCourses()
    return NextResponse.json({ courses })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao listar cursos' },
      { status: err.status || 500 }
    )
  }
}
