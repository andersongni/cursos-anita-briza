// Utility helpers

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

/** Apenas letras minúsculas, números e ponto. */
export const USERNAME_REGEX = /^[a-z0-9.]+$/

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username)
}

/** Nome completo com a primeira letra de cada palavra em maiúscula. */
export function formatFullName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase('pt-BR')
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
    })
    .join(' ')
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', options ?? {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Ex.: "02 de outubro de 2026" — usado no certificado. */
export function formatCertificateDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}min ${secs}s`
  }
  return `${minutes}min ${secs}s`
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export function generateCertificateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const segments = []
  for (let s = 0; s < 3; s++) {
    let segment = ''
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    segments.push(segment)
  }
  return segments.join('-')
}

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@anita-briza.internal`
}

export function emailToUsername(email: string): string {
  return email.replace('@anita-briza.internal', '')
}
