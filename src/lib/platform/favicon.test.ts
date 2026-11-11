/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { setSiteFavicon } from './favicon'

describe('setSiteFavicon', () => {
  it('no-op sem document/url', () => {
    expect(() => setSiteFavicon('')).not.toThrow()
    expect(() => setSiteFavicon('', { bustCache: true })).not.toThrow()
  })


  it('cria links quando ausentes', () => {
    document.head.innerHTML = ''
    setSiteFavicon('/favicon.png')
    const links = document.querySelectorAll('link[data-site-favicon="1"]')
    expect(links.length).toBe(3)
    expect(links[0].getAttribute('href')).toContain('/favicon.png?v=platform')
  })

  it('atualiza links existentes e bustCache', () => {
    document.head.innerHTML = `
      <link rel="icon" href="/old.png" />
      <link rel="shortcut icon" href="/old.png" />
      <link rel="apple-touch-icon" href="/old.png" />
    `
    setSiteFavicon('/new.png?already=1')
    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      '/new.png?already=1'
    )
    setSiteFavicon('/new.png', { bustCache: true })
    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toMatch(
      /\/new\.png\?v=\d+/
    )
  })
})
