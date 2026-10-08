/** Formato JSON para exportar/importar perguntas entre ambientes. */

export const QUESTION_TRANSFER_VERSION = 1 as const
export const QUESTION_TRANSFER_KIND = 'cursos-anita-briza.questions' as const

export type TransferOption = {
  option_key: string
  option_text: string
  is_correct: boolean
  explanation: string
}

export type TransferQuestion = {
  type: string
  format: 'MULTIPLE_CHOICE' | 'DISCURSIVE'
  question_text: string
  expected_answer: string | null
  active: boolean
  dimension_name: string
  options: TransferOption[]
}

export type QuestionTransferFile = {
  kind: typeof QUESTION_TRANSFER_KIND
  version: typeof QUESTION_TRANSFER_VERSION
  exportedAt: string
  courseSlug: string
  courseName?: string
  questions: TransferQuestion[]
}

export function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function isQuestionTransferFile(value: unknown): value is QuestionTransferFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Record<string, unknown>
  return (
    file.kind === QUESTION_TRANSFER_KIND &&
    file.version === QUESTION_TRANSFER_VERSION &&
    typeof file.courseSlug === 'string' &&
    Array.isArray(file.questions)
  )
}

export function validateTransferQuestion(
  raw: unknown,
  index: number
): { ok: true; question: TransferQuestion } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: `Item ${index + 1}: formato inválido` }
  }
  const q = raw as Record<string, unknown>
  const question_text =
    typeof q.question_text === 'string' ? normalizeQuestionText(q.question_text) : ''
  if (!question_text) {
    return { ok: false, error: `Item ${index + 1}: texto da pergunta obrigatório` }
  }

  const type = typeof q.type === 'string' ? q.type.trim().toUpperCase() : ''
  if (type !== 'PROVA' && type !== 'SIMULADO') {
    return {
      ok: false,
      error: `Item ${index + 1}: tipo inválido (use PROVA ou SIMULADO)`,
    }
  }

  let format: 'MULTIPLE_CHOICE' | 'DISCURSIVE' | null = null
  if (q.format === 'DISCURSIVE') format = 'DISCURSIVE'
  else if (q.format === 'MULTIPLE_CHOICE') format = 'MULTIPLE_CHOICE'
  if (!format) {
    return {
      ok: false,
      error: `Item ${index + 1}: formato inválido`,
    }
  }

  const dimension_name =
    typeof q.dimension_name === 'string' ? q.dimension_name.trim() : ''
  if (!dimension_name) {
    return { ok: false, error: `Item ${index + 1}: tema (dimension_name) obrigatório` }
  }

  const expected_answer =
    typeof q.expected_answer === 'string' ? q.expected_answer.trim() : null

  if (format === 'DISCURSIVE') {
    if (!expected_answer) {
      return {
        ok: false,
        error: `Item ${index + 1}: discursiva sem critérios (expected_answer)`,
      }
    }
    return {
      ok: true,
      question: {
        type,
        format,
        question_text,
        expected_answer,
        active: q.active !== false,
        dimension_name,
        options: [],
      },
    }
  }

  if (!Array.isArray(q.options) || q.options.length !== 5) {
    return {
      ok: false,
      error: `Item ${index + 1}: objetiva precisa de exatamente 5 alternativas`,
    }
  }

  const options: TransferOption[] = []
  for (const opt of q.options) {
    if (!opt || typeof opt !== 'object') {
      return { ok: false, error: `Item ${index + 1}: alternativa inválida` }
    }
    const o = opt as Record<string, unknown>
    const option_key = typeof o.option_key === 'string' ? o.option_key.trim() : ''
    const option_text = typeof o.option_text === 'string' ? o.option_text : ''
    if (!option_key || !option_text.trim()) {
      return {
        ok: false,
        error: `Item ${index + 1}: alternativa incompleta`,
      }
    }
    options.push({
      option_key,
      option_text: option_text.trim(),
      is_correct: Boolean(o.is_correct),
      explanation: typeof o.explanation === 'string' ? o.explanation : '',
    })
  }

  if (options.filter((o) => o.is_correct).length !== 1) {
    return {
      ok: false,
      error: `Item ${index + 1}: exatamente 1 alternativa correta é obrigatória`,
    }
  }

  return {
    ok: true,
    question: {
      type,
      format,
      question_text,
      expected_answer: null,
      active: q.active !== false,
      dimension_name,
      options,
    },
  }
}
