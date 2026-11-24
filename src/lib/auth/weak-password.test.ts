import { describe, expect, it } from 'vitest'
import { isWeakPassword } from './weak-password'

describe('isWeakPassword', () => {
  it('detecta senhas comuns e curtas', () => {
    expect(isWeakPassword('123456')).toBe(true)
    expect(isWeakPassword('senha')).toBe(true)
    expect(isWeakPassword('password')).toBe(true)
    expect(isWeakPassword('abc')).toBe(true)
    expect(isWeakPassword('111111')).toBe(true)
  })

  it('detecta senha igual ao usuário', () => {
    expect(isWeakPassword('maria', { username: 'maria' })).toBe(true)
    expect(isWeakPassword('Maria', { username: 'maria' })).toBe(true)
  })

  it('aceita senha razoável', () => {
    expect(isWeakPassword('Curs0Anita!')).toBe(false)
    expect(isWeakPassword('meuAcesso2026')).toBe(false)
  })
})
