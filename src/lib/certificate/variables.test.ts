import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultEditableVariables,
  createEditableVariable,
  editableVariablesToMap,
  normalizeEditableVariables,
  normalizeVariableKey,
  replaceVariableKeyInText,
  RESERVED_VARIABLE_KEYS,
  stripVariableBraces,
  suggestNewVariableKey,
} from './variables'

describe('certificate variables', () => {
  it('normaliza chaves', () => {
    expect(stripVariableBraces('{course_name}')).toBe('course_name')
    expect(normalizeVariableKey(' Course Name ')).toBe('{course_name}')
    expect(normalizeVariableKey('___')).toBe('')
    expect(normalizeVariableKey('_abc_')).toBe('{abc}')
    expect(normalizeVariableKey('{student_name}')).toBe('{student_name}')
    expect(RESERVED_VARIABLE_KEYS).toContain('{logo}')
  })


  it('defaults / normalize / map', () => {
    const defaults = createDefaultEditableVariables({
      institutionName: 'Inst',
      courseName: 'Curso',
      courseHours: 20,
      location: 'SP',
    })
    expect(defaults[0].value).toBe('Inst')

    expect(normalizeEditableVariables(null)).toEqual(createDefaultEditableVariables())
    expect(
      normalizeEditableVariables([{ key: '{student_name}', value: 'x' }], defaults)
    ).toEqual(defaults)
    expect(
      normalizeEditableVariables(
        [{ key: 'custom', value: 1, id: 'c1' }, null, 'x', { key: '', value: 'z' }],
        defaults
      )
    ).toEqual([{ id: 'c1', key: '{custom}', value: '1' }])
    expect(
      normalizeEditableVariables([{ key: 'x', value: null, id: 'n1' }], defaults)
    ).toEqual([{ id: 'n1', key: '{x}', value: '' }])
    expect(
      normalizeEditableVariables([{ key: 'y', value: '1' }, { key: 'y', value: '2' }], defaults)
    ).toHaveLength(1)
    expect(normalizeEditableVariables([], defaults, { allowEmpty: true })).toEqual([])



    const map = editableVariablesToMap(defaults)
    expect(map['{course_name}']).toBe('Curso')
    expect(map.course_name).toBe('Curso')
  })

  it('replace / suggest / create', () => {
    expect(replaceVariableKeyInText('a {x} b', '{x}', '{y}')).toBe('a {y} b')
    expect(replaceVariableKeyInText('a', '{x}', '{x}')).toBe('a')
    expect(suggestNewVariableKey([{ id: '1', key: '{var_1}', value: '' }])).toBe(
      '{var_2}'
    )
    const created = createEditableVariable({ key: 'foo', value: 'bar' })
    expect(created.key).toBe('{foo}')
    expect(createEditableVariable().key).toMatch(/^\{var_\d+\}$/)
  })

  it('gera id sem randomUUID', () => {
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      arr.fill(1)
      return arr
    })
    vi.stubGlobal('crypto', { getRandomValues })
    const vars = normalizeEditableVariables([{ key: 'z', value: '' }], [], {
      allowEmpty: true,
    })
    expect(vars[0].id).toMatch(/^var_/)
  })
})
