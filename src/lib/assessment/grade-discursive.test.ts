import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateGeminiText = vi.fn()
const gradingModelsToTry = vi.fn(() => ['m1'])

vi.mock('@/lib/gemini/client', () => ({
  generateGeminiText,
  gradingModelsToTry,
}))

import { gradeDiscursiveAnswer, gradeDiscursiveAnswers } from './grade-discursive'

describe('grade-discursive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('marca resposta em branco', async () => {
    const map = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite 2 exemplos',
        expectedAnswer: 'Aceitar: word, excel',
        studentAnswer: '  ',
      },
    ])
    expect(map.get('1')?.scorePercent).toBe(0)
    expect(generateGeminiText).not.toHaveBeenCalled()
  })

  it('usa local first quando habilitado', async () => {
    vi.stubEnv('DISCURSIVE_LOCAL_FIRST', '1')
    const map = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite dois exemplos de editor',
        expectedAnswer: 'Aceitar: microsoft word, libreoffice writer, google docs',
        studentAnswer: 'word e excel',
      },
    ])
    expect(map.get('1')?.scorePercent).toBeGreaterThan(0)
    expect(generateGeminiText).not.toHaveBeenCalled()
  })

  it('usa IA em lote e faz fallback local', async () => {
    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify({
        grades: [
          { id: '1', scorePercent: 80, feedback: 'Bom uso de Gemini na resposta' },
          { id: 'only-ia', scorePercent: 40, feedback: 'IA' },
          { id: 'blank-fb', scorePercent: 55, feedback: '   ', comentario: '' },
        ],
      }),
    })

    const map = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
      {
        id: 'only-ia',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
      {
        id: 'blank-fb',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
    ])
    expect(map.get('1')?.scorePercent).toBe(80)
    expect(map.get('1')?.feedback).not.toMatch(/Gemini/i)
    expect(map.get('only-ia')?.feedback).toMatch(/Revise o conteúdo/)
    expect(map.get('blank-fb')?.feedback).toMatch(/Revise o conteúdo/)


    generateGeminiText.mockResolvedValueOnce({ ok: false, error: 'down' })
    const fallback = await gradeDiscursiveAnswers([
      {
        id: '2',
        questionText: 'Cite três exemplos',
        expectedAnswer: 'Aceitar: word; excel; powerpoint; access',
        studentAnswer: 'word, excel, photoshop',
      },
    ])
    expect(fallback.get('2')?.feedback).toBeTruthy()
  })

  it('parseia JSON embutido e grade sem id em item único', async () => {
    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: 'prefix {"grades":[{"id":"1","scorePercent":50,"comentario":"ok"}]} suffix',
    })
    const embedded = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Q',
        expectedAnswer: 'Aceitar: a, b, c',
        studentAnswer: 'a',
      },
    ])
    expect(embedded.get('1')?.scorePercent).toBe(50)

    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify({ scorePercent: 70, feedback: 'feedback' }),
    })
    const single = await gradeDiscursiveAnswer({
      questionText: 'Cite um exemplo',
      expectedAnswer: 'Aceitar: word, excel',
      studentAnswer: 'word',
    })
    expect(single.scorePercent).toBe(70)
  })

  it('fallback local cobre vazios e match plural/tokens', async () => {
    generateGeminiText.mockResolvedValue({ ok: false, error: 'x' })
    const blankExpected = await gradeDiscursiveAnswer({
      questionText: 'Q',
      expectedAnswer: '',
      studentAnswer: 'algo',
    })
    expect(blankExpected.scorePercent).toBe(0)

    const plural = await gradeDiscursiveAnswer({
      questionText: 'Cite 2 sites',
      expectedAnswer: 'Aceitar: site, jogo, app',
      studentAnswer: 'sites e jogos',
    })
    expect(plural.scorePercent).toBeGreaterThan(0)

    const short = await gradeDiscursiveAnswer({
      questionText: 'Cite 1',
      expectedAnswer: 'Aceitar: sql, api, ui',
      studentAnswer: 'sql',
    })
    expect(short.scorePercent).toBeGreaterThan(0)

    const shortMiss = await gradeDiscursiveAnswer({
      questionText: 'Cite 1',
      expectedAnswer: 'Aceitar: sql, api, ui',
      studentAnswer: 'xyz',
    })
    expect(shortMiss.scorePercent).toBe(0)


    const perfect = await gradeDiscursiveAnswer({
      questionText: 'Cite dois exemplos',
      expectedAnswer: 'Aceitar: word, excel',
      studentAnswer: 'word, excel',
    })
    expect(perfect.scorePercent).toBe(100)
    expect(perfect.feedback).toMatch(/acertou/i)

    const emptyItems = await gradeDiscursiveAnswer({
      questionText: 'Cite um',
      expectedAnswer: 'Aceitar: ab',
      studentAnswer: 'x',
    })
    expect(emptyItems.feedback).toBeTruthy()

    const noCriteriaWords = await gradeDiscursiveAnswer({
      questionText: 'Cite tres exemplos',
      expectedAnswer: 'Aceitar: exemplos como tambem incluindo',
      studentAnswer: 'qualquer coisa boa',
    })
    expect(noCriteriaWords.scorePercent).toBe(0)

    const onlyCorrectShort = await gradeDiscursiveAnswer({
      questionText: 'Cite um exemplo',
      expectedAnswer: 'Aceitar: www',
      studentAnswer: 'www',
    })
    expect(onlyCorrectShort.scorePercent).toBe(100)



    const tokenMatch = await gradeDiscursiveAnswer({
      questionText: 'Cite 2',
      expectedAnswer: 'Aceitar: microsoft word, google docs',
      studentAnswer: 'microsoft word',
    })
    expect(tokenMatch.scorePercent).toBeGreaterThan(0)
  })

  it('tolera respostas IA malformadas', async () => {
    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: 'sem json nenhum',
    })
    const noJson = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
    ])
    expect(noJson.get('1')?.scorePercent).toBeGreaterThanOrEqual(0)

    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: 'xx {"grades":"nope"} yy',
    })
    const badGrades = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
    ])
    expect(badGrades.get('1')).toBeTruthy()

    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: 'xx {not-json} yy',
    })
    const badEmbed = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
    ])
    expect(badEmbed.get('1')).toBeTruthy()

    generateGeminiText.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify({ grades: [{ id: '1', scorePercent: 'x' }] }),
    })
    const badScore = await gradeDiscursiveAnswers([
      {
        id: '1',
        questionText: 'Cite 2',
        expectedAnswer: 'Aceitar: word, excel, powerpoint',
        studentAnswer: 'word',
      },
    ])
    expect(badScore.get('1')?.feedback).toBeTruthy()

    generateGeminiText.mockResolvedValueOnce({ ok: true, text: JSON.stringify({}) })
    expect(
      (
        await gradeDiscursiveAnswers([
          {
            id: '1',
            questionText: 'Q',
            expectedAnswer: 'Aceitar: a, b, c',
            studentAnswer: 'a',
          },
        ])
      ).get('1')
    ).toBeTruthy()
  })
})

