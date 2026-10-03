/** Abre o PDF do certificado em nova aba (visualizar). */
export function viewCertificatePdf(id: string) {
  window.open(`/api/certificates/${id}/pdf`, '_blank', 'noopener,noreferrer')
}

/** Baixa o PDF do certificado. */
export function downloadCertificatePdf(id: string, filename?: string) {
  const a = document.createElement('a')
  a.href = `/api/certificates/${id}/pdf?download=1`
  a.download = filename ?? `certificado-${id}.pdf`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
