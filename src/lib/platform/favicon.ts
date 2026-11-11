/** Atualiza o ícone da aba do navegador (favicon / apple-touch-icon). */
export function setSiteFavicon(url: string) {
  if (typeof document === 'undefined' || !url) return

  const href = url.includes('?') ? url : `${url}?v=${Date.now()}`

  // Remove qualquer favicon estático antigo (favicon.ico, apple-icon.png do Next, etc.)
  document
    .querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
    )
    .forEach((el) => el.remove())

  const add = (rel: string, sizes?: string) => {
    const link = document.createElement('link')
    link.rel = rel
    link.type = 'image/png'
    link.href = href
    if (sizes) link.setAttribute('sizes', sizes)
    document.head.appendChild(link)
  }

  add('icon')
  add('shortcut icon')
  add('apple-touch-icon', '180x180')
}
