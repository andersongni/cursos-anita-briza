/**
 * Recalcula notas de discursivas e a nota final de uma avaliação já concluída.
 */
import { createScriptPrisma } from './prisma-client'
import { gradeDiscursiveAnswer } from '../src/lib/assessment/grade-discursive'
import { getAssessmentSettings } from '../src/lib/settings/assessment'

const prisma = createScriptPrisma()
const id = process.argv[2]

async function main() {
  if (!id) {
    console.error('Uso: npx tsx scripts/regrade-assessment.ts <assessmentId>')
    process.exit(1)
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { questions: true, answers: true },
  })
  if (!assessment) {
    console.error('Avaliação não encontrada')
    process.exit(1)
  }
  if (assessment.status !== 'COMPLETED') {
    console.error('Só reavalia avaliações COMPLETED')
    process.exit(1)
  }

  const settings = await getAssessmentSettings(
    assessment.type.toLowerCase() === 'prova' ? 'prova' : 'simulado',
    assessment.course_id
  )

  const mcQuestions = assessment.questions.filter((q) => q.format !== 'DISCURSIVE')
  const discursiveQuestions = assessment.questions.filter(
    (q) => q.format === 'DISCURSIVE'
  )

  let mcCorrect = 0
  let mcWrong = 0
  const mcScores: number[] = []
  const discursiveScores: number[] = []

  for (const question of assessment.questions) {
    const answer = assessment.answers.find(
      (a) => a.assessment_question_id === question.id
    )

    if (question.format === 'DISCURSIVE') {
      const text = (answer?.text_answer || '').trim()
      const grade = await gradeDiscursiveAnswer({
        questionText: question.question_text_snapshot,
        expectedAnswer: question.expected_answer_snapshot || '',
        studentAnswer: text,
      })
      discursiveScores.push(grade.scorePercent)
      console.log(
        `Discursiva: "${question.question_text_snapshot.slice(0, 40)}" → ${grade.scorePercent}% (${grade.feedback})`
      )
      if (answer) {
        await prisma.assessmentAnswer.update({
          where: { id: answer.id },
          data: {
            score_percent: grade.scorePercent,
            grading_feedback: grade.feedback,
            is_correct: grade.scorePercent >= 70,
          },
        })
      }
      continue
    }

    const selected = answer?.selected_option
    const isCorrect = Boolean(selected) && selected === question.correct_option
    mcScores.push(isCorrect ? 100 : 0)
    if (selected) {
      if (isCorrect) mcCorrect++
      else mcWrong++
    } else {
      mcWrong++
    }
  }

  const mcAvg =
    mcQuestions.length > 0
      ? mcScores.reduce((s, n) => s + n, 0) / mcQuestions.length
      : 0
  const discursiveAvg =
    discursiveQuestions.length > 0
      ? discursiveScores.reduce((s, n) => s + n, 0) / discursiveQuestions.length
      : 0

  let mcWeight = settings.mcWeightPercent
  let discWeight = settings.discursiveWeightPercent
  if (mcQuestions.length === 0 && discursiveQuestions.length > 0) {
    mcWeight = 0
    discWeight = 100
  } else if (discursiveQuestions.length === 0 && mcQuestions.length > 0) {
    mcWeight = 100
    discWeight = 0
  }

  const score = (mcAvg * mcWeight) / 100 + (discursiveAvg * discWeight) / 100
  const passed = score >= settings.passingScore

  await prisma.assessment.update({
    where: { id },
    data: {
      score: Math.round(score * 10) / 10,
      correct_count: mcCorrect,
      wrong_count: mcWrong,
      passed,
    },
  })

  console.log({
    mcAvg,
    discursiveAvg,
    mcWeight,
    discWeight,
    score: Math.round(score * 10) / 10,
    passed,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
