import { describe, expect, it } from 'vitest'
import {
  isQuestionTransferFile,
  normalizeQuestionText,
  QUESTION_TRANSFER_KIND,
  QUESTION_TRANSFER_VERSION,
  validateTransferQuestion,
} from './question-transfer'

describe('question-transfer', () => {
  it('normaliza texto e valida arquivo', () => {
    expect(normalizeQuestionText('  a   b  ')).toBe('a b')
    expect(isQuestionTransferFile(null)).toBe(false)
    expect(
      isQuestionTransferFile({
        kind: QUESTION_TRANSFER_KIND,
        version: QUESTION_TRANSFER_VERSION,
        courseSlug: 'x',
        questions: [],
      })
    ).toBe(true)
  })

  it('valida discursiva e MC', () => {
    expect(validateTransferQuestion(null, 0).ok).toBe(false)
    expect(validateTransferQuestion('x', 0).ok).toBe(false)
    expect(validateTransferQuestion({ question_text: '' }, 0).ok).toBe(false)
    expect(validateTransferQuestion({ question_text: 1 }, 0).ok).toBe(false)

    expect(
      validateTransferQuestion(
        { question_text: 'Q?', type: 'QUIZ', format: 'DISCURSIVE', dimension_name: 'T' },
        0
      ).ok
    ).toBe(false)
    expect(
      validateTransferQuestion(
        { question_text: 'Q?', type: 'PROVA', format: 'X', dimension_name: 'T' },
        0
      ).ok
    ).toBe(false)
    expect(
      validateTransferQuestion(
        { question_text: 'Q?', type: 'PROVA', format: 'DISCURSIVE', dimension_name: '' },
        0
      ).ok
    ).toBe(false)
    expect(
      validateTransferQuestion(
        {
          question_text: 'Q?',
          type: 'PROVA',
          format: 'DISCURSIVE',
          dimension_name: 'Tema',
        },
        0
      ).ok
    ).toBe(false)

    const disc = validateTransferQuestion(
      {
        question_text: ' Explique ',
        type: 'simulado',
        format: 'DISCURSIVE',
        dimension_name: 'Tema',
        expected_answer: 'critérios',
      },
      0
    )
    expect(disc.ok).toBe(true)
    if (disc.ok) {
      expect(disc.question.type).toBe('SIMULADO')
      expect(disc.question.options).toEqual([])
    }

    expect(
      validateTransferQuestion(
        {
          question_text: 'MC?',
          type: 'PROVA',
          format: 'MULTIPLE_CHOICE',
          dimension_name: 'Tema',
          options: [],
        },
        0
      ).ok
    ).toBe(false)

    expect(
      validateTransferQuestion(
        {
          question_text: 'Q?',
          type: 'PROVA',
          format: 'DISCURSIVE',
          dimension_name: 1,
          expected_answer: 'x',
        },
        0
      ).ok
    ).toBe(false)

    const badOpt = validateTransferQuestion(
      {
        question_text: 'MC?',
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        dimension_name: 'Tema',
        options: [null, {}, {}, {}, {}],
      },
      0
    )
    expect(badOpt.ok).toBe(false)

    const badOptObj = validateTransferQuestion(
      {
        question_text: 'MC?',
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        dimension_name: 'Tema',
        options: ['x', {}, {}, {}, {}],
      },
      0
    )
    expect(badOptObj.ok).toBe(false)


    const incomplete = validateTransferQuestion(
      {
        question_text: 'MC?',
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        dimension_name: 'Tema',
        options: Array.from({ length: 5 }, () => ({
          option_key: '',
          option_text: 'x',
          is_correct: false,
        })),
      },
      0
    )
    expect(incomplete.ok).toBe(false)

    const blankText = validateTransferQuestion(
      {
        question_text: 'MC?',
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        dimension_name: 'Tema',
        options: Array.from({ length: 5 }, (_, i) => ({
          option_key: String.fromCharCode(65 + i),
          option_text: '   ',
          is_correct: i === 0,
        })),
      },
      0
    )
    expect(blankText.ok).toBe(false)

    expect(
      validateTransferQuestion(
        {
          question_text: 'Q?',
          type: '   ',
          format: 'DISCURSIVE',
          dimension_name: 'Tema',
          expected_answer: 'x',
        },
        0
      ).ok
    ).toBe(false)


    const twoCorrect = validateTransferQuestion(
      {
        question_text: 'MC?',
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        dimension_name: 'Tema',
        options: [
          { option_key: 'A', option_text: '1', is_correct: true },
          { option_key: 'B', option_text: '2', is_correct: true },
          { option_key: 'C', option_text: '3', is_correct: false },
          { option_key: 'D', option_text: '4', is_correct: false },
          { option_key: 'E', option_text: '5', is_correct: false },
        ],
      },
      0
    )
    expect(twoCorrect.ok).toBe(false)

    const ok = validateTransferQuestion(
      {
        question_text: 'MC?',
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        dimension_name: 'Tema',
        active: false,
        options: [
          { option_key: 'A', option_text: '1', is_correct: true, explanation: 'ok' },
          { option_key: 'B', option_text: '2', is_correct: false },
          { option_key: 'C', option_text: '3', is_correct: false },
          { option_key: 'D', option_text: '4', is_correct: false },
          { option_key: 'E', option_text: '5', is_correct: false },
        ],
      },
      0
    )
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.question.active).toBe(false)
  })
})
