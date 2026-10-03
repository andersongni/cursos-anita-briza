import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth/verify';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAuth();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { question_order: 'asc' } },
        answers: true
      }
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 });
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (assessment.type === 'PROVA') {
      return NextResponse.json({ error: 'Revisão não disponível para provas' }, { status: 403 });
    }
    
    if (assessment.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Avaliação ainda não concluída' }, { status: 400 });
    }

    return NextResponse.json({ assessment });
  } catch (error: any) {
    console.error('Review assessment error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar revisão' }, { status: 500 });
  }
}
