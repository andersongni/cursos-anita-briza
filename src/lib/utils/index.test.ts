import { describe, expect, it, vi } from 'vitest'
import {
  cn,
  formatCertificateDate,
  formatDate,
  formatDateTime,
  formatDuration,
  formatFullName,
  formatPhoneMask,
  generateCertificateCode,
  isValidBrazilianMobile,
  isValidEmail,
  isValidFullName,
  isValidUsername,
  phoneDigits,
} from './index'

describe('cn', () => {
  it('junta classes truthy', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('username / nome / email', () => {
  it('valida username', () => {
    expect(isValidUsername('ana.briza')).toBe(true)
    expect(isValidUsername('Ana')).toBe(false)
    expect(isValidUsername('ana_briza')).toBe(false)
  })

  it('valida nome completo', () => {
    expect(isValidFullName('Ana Briza')).toBe(true)
    expect(isValidFullName('  Ana   Silva  ')).toBe(true)
    expect(isValidFullName('Ana')).toBe(false)
    expect(isValidFullName('   ')).toBe(false)
  })

  it('valida email', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('  a@b.com  ')).toBe(true)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('sem-arroba')).toBe(false)
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false)
  })
})

describe('telefone', () => {
  it('extrai dígitos e formata máscara', () => {
    expect(phoneDigits('(11) 98888-7777')).toBe('11988887777')
    expect(formatPhoneMask('')).toBe('')
    expect(formatPhoneMask('1')).toBe('(1')
    expect(formatPhoneMask('11')).toBe('(11')
    expect(formatPhoneMask('11988')).toBe('(11) 988')
    expect(formatPhoneMask('11988887777')).toBe('(11) 98888-7777')
    expect(isValidBrazilianMobile('11988887777')).toBe(true)
    expect(isValidBrazilianMobile('1188887777')).toBe(false)
  })
})

describe('formatters', () => {
  it('formata nome completo', () => {
    expect(formatFullName('  ana   briza ')).toBe('Ana Briza')
  })

  it('formata datas', () => {
    const d = new Date('2026-10-02T12:00:00.000Z')
    expect(formatDate(d)).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(formatDate('2026-10-02T12:00:00.000Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(formatDate(d, { year: 'numeric' })).toMatch(/2026/)
    expect(formatCertificateDate(d)).toMatch(/2026/)
    expect(formatCertificateDate('2026-10-02T12:00:00.000Z')).toMatch(/2026/)
    expect(formatDateTime(d)).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(formatDateTime('2026-10-02T12:00:00.000Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('formata duração', () => {
    expect(formatDuration(65)).toBe('1min 5s')
    expect(formatDuration(3665)).toBe('1h 1min 5s')
  })

  it('gera código de certificado', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(generateCertificateCode()).toBe('AAAA-AAAA-AAAA')
  })
})
