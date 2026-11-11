import { describe, expect, it } from 'vitest'
import { isProfileDeleted, notDeleted, ofActiveStudent } from './soft-delete'

describe('soft-delete', () => {
  it('exporta filtros prisma', () => {
    expect(notDeleted).toEqual({ deleted_at: null })
    expect(ofActiveStudent).toEqual({ student: { deleted_at: null } })
  })

  it('detecta perfil excluído', () => {
    expect(isProfileDeleted({ deleted_at: null })).toBe(false)
    expect(isProfileDeleted({})).toBe(false)
    expect(isProfileDeleted({ deleted_at: new Date() })).toBe(true)
    expect(isProfileDeleted({ deleted_at: '2026-01-01' })).toBe(true)
  })
})
