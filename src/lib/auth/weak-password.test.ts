import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { hashMatchesWeakPassword, isWeakPassword } from './weak-password'

describe('isWeakPassword', () => {
  it('detecta senhas comuns e curtas', () => {
    expect(isWeakPassword('123456')).toBe(true)
    expect(isWeakPassword('senha')).toBe(true)
    expect(isWeakPassword('password')).toBe(true)
    expect(isWeakPassword('abc')).toBe(true)
    expect(isWeakPassword('111111')).toBe(true)
    expect(isWeakPassword('22222222')).toBe(true)
    expect(isWeakPassword('123456123456')).toBe(true)
    expect(isWeakPassword('')).toBe(true)
    expect(isWeakPassword('   ')).toBe(true)
  })

  it('detecta senha igual ao usuário', () => {
    expect(isWeakPassword('maria', { username: 'maria' })).toBe(true)
    expect(isWeakPassword('Maria', { username: 'maria' })).toBe(true)
    expect(isWeakPassword('Curs0Anita!', { username: '  ' })).toBe(false)
    expect(isWeakPassword('Curs0Anita!', { username: null })).toBe(false)
  })

  it('aceita senha razoável', () => {
    expect(isWeakPassword('Curs0Anita!')).toBe(false)
    expect(isWeakPassword('meuAcesso2026')).toBe(false)
  })
})

describe('hashMatchesWeakPassword', () => {
  it('reconhece hash de senha comum', async () => {
    const hash = await bcrypt.hash('123456', 4)
    expect(await hashMatchesWeakPassword(hash)).toBe(true)
  })

  it('retorna false para senha forte ou hash inválido', async () => {
    const hash = await bcrypt.hash('Curs0Anita!forte', 4)
    expect(await hashMatchesWeakPassword(hash)).toBe(false)
    expect(await hashMatchesWeakPassword('not-a-bcrypt-hash')).toBe(false)
  })
})
