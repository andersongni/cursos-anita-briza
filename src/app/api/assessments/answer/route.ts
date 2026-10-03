import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth/verify';

export async function POST(req: Request) {
  try {
    const { user } = await verifyAuth();
    const body = await req.json();
    const assessment_id = body.assessment_id || body.assessmentId;
    const assessment_question_id = body.assessment_question_id || body.questionId;
    const selected_option = body.selected_option ?? body.optionId;
    const flagged_for_review = body.flagged_for_review ?? body.isFlagged;

    if (!assessment_id || !assessment_question_id) {
      return NextResponse.json({ error: 'Faltando parâmetros obrigatórios' }, { status: 400 });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessment_id }
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 });
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Avaliação não está em andamento' }, { status: 400 });
    }

    if (assessment.deadline_at && new Date() > assessment.deadline_at) {
      return NextResponse.json({ error: 'Tempo esgotado para esta avaliação' }, { status: 400 });
    }

    await prisma.assessmentAnswer.update({
      where: { 
        assessment_id_assessment_question_id: { 
          assessment_id, 
          assessment_question_id 
        } 
      },
      data: { 
        selected_option: selected_option !== undefined ? selected_option : undefined, 
        flagged_for_review: flagged_for_review !== undefined ? flagged_for_review : undefined, 
        answered_at: selected_option ? new Date() : undefined
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Answer assessment error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao salvar resposta' }, { status: 500 });
  }
}
