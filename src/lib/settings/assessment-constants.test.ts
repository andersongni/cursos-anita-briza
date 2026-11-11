import { describe, expect, it } from 'vitest'
import {
  PROVA_UNLOCK_UNTIL_KEY,
  PROVA_UNLOCK_WINDOW_HOURS,
  provaUnlockUntilKey,
} from './assessment-constants'
import {
  assessmentCourseSettingKey,
  isLegacyAssessmentSettingKey,
  mirroredAssessmentSettingKey,
  parseSettingNumber,
} from './assessment'

describe('assessment constants / keys', () => {
  it('gera chaves e janela', () => {
    expect(PROVA_UNLOCK_WINDOW_HOURS).toBe(2)
    expect(PROVA_UNLOCK_UNTIL_KEY).toContain('unlock_until')
    expect(provaUnlockUntilKey('c1')).toBe('assessment.prova.unlock_until.c1')
    expect(assessmentCourseSettingKey('c1', 'passing_score')).toBe(
      'assessment.course.c1.passing_score'
    )
  })

  it('espelha e detecta chaves legadas', () => {
    expect(mirroredAssessmentSettingKey('assessment.prova.question_count')).toBe(
      'assessment.simulado.question_count'
    )
    expect(mirroredAssessmentSettingKey('assessment.simulado.passing_score')).toBe(
      'assessment.prova.passing_score'
    )
    expect(mirroredAssessmentSettingKey('other')).toBeNull()
    expect(isLegacyAssessmentSettingKey('assessment.prova.mc_weight_percent')).toBe(
      'mc_weight_percent'
    )
    expect(isLegacyAssessmentSettingKey('x')).toBeNull()
  })

  it('parseSettingNumber', () => {
    expect(parseSettingNumber(null, 5)).toBe(5)
    expect(parseSettingNumber('', 5)).toBe(5)
    expect(parseSettingNumber(undefined, 5)).toBe(5)
    expect(parseSettingNumber('10', 5)).toBe(10)
    expect(parseSettingNumber('"12"', 5)).toBe(12)
    expect(parseSettingNumber('abc', 7)).toBe(7)
    expect(parseSettingNumber('"nope"', 3)).toBe(3)
    expect(parseSettingNumber('NaN', 9)).toBe(9)
    expect(parseSettingNumber('{}', 4)).toBe(4)
    expect(parseSettingNumber('null', 2)).toBe(0)
    expect(parseSettingNumber('true', 8)).toBe(1)


  })
})


