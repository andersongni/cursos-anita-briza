import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth/verify';

export async function POST(req: Request) {
  try {
    const { user } = await verifyAuth();
    const body = await req.json();
    const assessment_id = body.assessment_id || body.assessmentId;

    if (!assessment_id) {
      return NextResponse.json({ error: 'ID da avaliação não fornecido' }, { status: 400 });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessment_id },
      include: {
        questions: true,
        answers: true
      }
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 });
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Apenas avaliações em andamento podem ser enviadas' }, { status: 400 });
    }

    let correctCount = 0;
    let wrongCount = 0;

    // Grade each answer
    const answerUpdates = assessment.answers.map(answer => {
      const question = assessment.questions.find(q => q.id === answer.assessment_question_id);
      if (!question) return null;

      const is_correct = answer.selected_option === question.correct_option;
      if (answer.selected_option) {
        if (is_correct) correctCount++;
        else wrongCount++;
      } else {
        wrongCount++; // unanswered is wrong
      }

      return prisma.assessmentAnswer.update({
        where: { id: answer.id },
        data: { is_correct }
      });
    }).filter(Boolean);

    await prisma.$transaction(answerUpdates as any);

    if (assessment.total_questions <= 0 || assessment.questions.length === 0) {
      return NextResponse.json(
        { error: 'Esta avaliação não possui questões e não pode ser finalizada.' },
        { status: 400 }
      );
    }

    const score = (correctCount / assessment.total_questions) * 100;

    const passingScoreSetting = await prisma.systemSetting.findUnique({
      where: { key: `assessment.${assessment.type.toLowerCase()}.passing_score` }
    });
    const passingScore = passingScoreSetting ? Number(JSON.parse(passingScoreSetting.value)) : 70;

    const passed = score >= passingScore;
    const completedAt = new Date();
    
    let durationSeconds = 0;
    if (assessment.started_at) {
      durationSeconds = Math.floor((completedAt.getTime() - new Date(assessment.started_at).getTime()) / 1000);
    }

    const updatedAssessment = await prisma.assessment.update({
      where: { id: assessment_id },
      data: {
        status: 'COMPLETED',
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        score,
        correct_count: correctCount,
        wrong_count: wrongCount,
        passed
      }
    });

    return NextResponse.json({
      success: true,
      assessment: {
        id: updatedAssessment.id,
        type: updatedAssessment.type,
        status: updatedAssessment.status,
        score: updatedAssessment.score,
        passed: updatedAssessment.passed,
        correct_count: updatedAssessment.correct_count,
        wrong_count: updatedAssessment.wrong_count,
        total_questions: updatedAssessment.total_questions,
        review_available: updatedAssessment.type === 'SIMULADO'
      }
    });
  } catch (error: any) {
    console.error('Submit assessment error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao enviar avaliação' }, { status: 500 });
  }
}
