/** Atualiza o ícone da aba do navegador (favicon / apple-touch-icon). */
export function setSiteFavicon(url: string) {
  if (typeof document === 'undefined' || !url) return

  const href = url.includes('?') ? url : `${url}?v=${Date.now()}`

  const ensureLink = (rel: string, sizes?: string) => {
    let link = document.querySelector<HTMLLinkElement>(
      sizes
        ? `link[rel="${rel}"][sizes="${sizes}"]`
        : `link[rel="${rel}"]:not([sizes])`
    )
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      if (sizes) link.sizes = sizes
      document.head.appendChild(link)
    }
    link.type = 'image/png'
    link.href = href
  }

  // Substitui qualquer favicon injetado pelo Next (icon.png etc.)
  document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]').forEach((el) => {
    el.href = href
  })

  ensureLink('icon')
  ensureLink('shortcut icon')
  ensureLink('apple-touch-icon')
}
