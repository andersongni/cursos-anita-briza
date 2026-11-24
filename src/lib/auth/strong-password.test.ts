import { describe, expect, it } from 'vitest'
import {
  checkPasswordComplexity,
  generateStrongPassword,
} from './strong-password'

describe('checkPasswordComplexity', () => {
  it('rejeita senhas incompletas', () => {
    expect(checkPasswordComplexity('Abcdef1').ok).toBe(false)
    expect(checkPasswordComplexity('abcdef1!').ok).toBe(false)
    expect(checkPasswordComplexity('ABCDEF1!').ok).toBe(false)
    expect(checkPasswordComplexity('Abcdefgh!').ok).toBe(false)
    expect(checkPasswordComplexity('Abcdef12').ok).toBe(false)
  })

  it('aceita senha com maiúscula, minúscula, número e especial', () => {
    expect(checkPasswordComplexity('Abcdef1!').ok).toBe(true)
  })
})

describe('generateStrongPassword', () => {
  it('sempre atende a complexidade', () => {
    for (let i = 0; i < 40; i++) {
      const pwd = generateStrongPassword(10)
      expect(pwd.length).toBe(10)
      expect(checkPasswordComplexity(pwd).ok).toBe(true)
    }
  })
})
