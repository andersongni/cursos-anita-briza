/**
 * Atualiza o ícone da aba sem remover nós do <head> gerenciados pelo Next/React.
 * Remover links com .remove() durante a navegação causa:
 * "Cannot read properties of null (reading 'removeChild')".
 */
export function setSiteFavicon(
  url: string,
  options?: { bustCache?: boolean }
) {
  if (typeof document === 'undefined' || !url) return

  const base = url.split('?')[0] || url
  const href = options?.bustCache
    ? `${base}?v=${Date.now()}`
    : url.includes('?')
      ? url
      : `${base}?v=platform`

  const targets: Array<{ rel: string; sizes?: string }> = [
    { rel: 'icon' },
    { rel: 'shortcut icon' },
    { rel: 'apple-touch-icon', sizes: '180x180' },
  ]

  for (const { rel, sizes } of targets) {
    const existing = Array.from(
      document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
    )

    if (existing.length > 0) {
      for (const el of existing) {
        el.type = 'image/png'
        if (sizes) el.setAttribute('sizes', sizes)
        // Atualiza in-place — não remove do DOM
        if (el.getAttribute('href') !== href) {
          el.setAttribute('href', href)
        }
      }
      continue
    }

    const link = document.createElement('link')
    link.rel = rel
    link.type = 'image/png'
    link.href = href
    if (sizes) link.setAttribute('sizes', sizes)
    link.setAttribute('data-site-favicon', '1')
    document.head.appendChild(link)
  }
}
