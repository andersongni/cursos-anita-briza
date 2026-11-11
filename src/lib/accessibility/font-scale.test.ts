import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyFontScale,
  FONT_SCALE_LABELS,
  FONT_SCALE_STORAGE_KEY,
  FONT_SCALES,
  isFontScale,
  nextFontScale,
  persistFontScale,
  prevFontScale,
  readStoredFontScale,
} from './font-scale'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('font-scale helpers', () => {
  it('valida escalas e labels', () => {
    expect(isFontScale(1.25)).toBe(true)
    expect(isFontScale(1.3)).toBe(false)
    expect(isFontScale('1')).toBe(false)
    expect(FONT_SCALE_LABELS[1]).toBe('Normal')
    expect(FONT_SCALES).toContain(1.5)
  })

  it('navega escalas', () => {
    expect(nextFontScale(1)).toBe(1.125)
    expect(nextFontScale(1.5)).toBe(1.5)
    expect(prevFontScale(1.125)).toBe(1)
    expect(prevFontScale(1)).toBe(1)
  })

  it('readStoredFontScale sem window retorna 1', () => {
    expect(readStoredFontScale()).toBe(1)
  })

  it('lê e persiste no localStorage', () => {
    const store = new Map<string, string>()
    const localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }
    const style = { setProperty: vi.fn(), fontSize: '' }
    const dataset: Record<string, string> = {}
    const dispatchEvent = vi.fn()

    vi.stubGlobal('window', { localStorage, dispatchEvent })
    vi.stubGlobal('document', {
      documentElement: { style, dataset },
    })
    vi.stubGlobal('localStorage', localStorage)

    expect(readStoredFontScale()).toBe(1)
    store.set(FONT_SCALE_STORAGE_KEY, '1.25')
    expect(readStoredFontScale()).toBe(1.25)
    store.set(FONT_SCALE_STORAGE_KEY, '9')
    expect(readStoredFontScale()).toBe(1)

    applyFontScale(1.5)
    expect(style.setProperty).toHaveBeenCalledWith('--a11y-scale', '1.5')
    expect(style.fontSize).toBe('24px')
    expect(dataset.fontScale).toBe('1.5')

    persistFontScale(1.125)
    expect(store.get(FONT_SCALE_STORAGE_KEY)).toBe('1.125')
    expect(dispatchEvent).toHaveBeenCalled()
  })

  it('ignora falhas de storage', () => {
    const localStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() })
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty: vi.fn(), fontSize: '' }, dataset: {} },
    })
    vi.stubGlobal('localStorage', localStorage)
    expect(readStoredFontScale()).toBe(1)
    expect(() => persistFontScale(1)).not.toThrow()
  })

  it('applyFontScale sem document é no-op', () => {
    expect(() => applyFontScale(1)).not.toThrow()
  })
})
