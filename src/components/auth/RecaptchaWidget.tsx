'use client'

import { useEffect, useId, useRef } from 'react'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      render: (
        container: string | HTMLElement,
        parameters: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark'
        }
      ) => number
      reset: (widgetId?: number) => void
      getResponse: (widgetId?: number) => string
    }
    __anitaRecaptchaApiLoaded?: boolean
  }
}

type Props = {
  siteKey: string
  onChange: (token: string) => void
  resetKey?: number
}

let scriptPromise: Promise<void> | null = null

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha?.render) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-anita-recaptcha="1"]'
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar reCAPTCHA')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.anitaRecaptcha = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar reCAPTCHA'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export default function RecaptchaWidget({ siteKey, onChange, resetKey = 0 }: Props) {
  const domId = useId().replace(/:/g, '')
  const containerId = `recaptcha-${domId}`
  const widgetIdRef = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false

    async function mount() {
      try {
        await loadRecaptchaScript()
        if (cancelled || !window.grecaptcha) return

        window.grecaptcha.ready(() => {
          if (cancelled || !window.grecaptcha) return

          const el = document.getElementById(containerId)
          if (!el) return

          if (widgetIdRef.current != null) {
            window.grecaptcha.reset(widgetIdRef.current)
            onChangeRef.current('')
            return
          }

          el.innerHTML = ''
          widgetIdRef.current = window.grecaptcha.render(el, {
            sitekey: siteKey,
            callback: (token: string) => onChangeRef.current(token),
            'expired-callback': () => onChangeRef.current(''),
            'error-callback': () => onChangeRef.current(''),
            theme: 'light',
          })
        })
      } catch {
        // UI mostra aviso se o widget não carregar
      }
    }

    void mount()

    return () => {
      cancelled = true
    }
  }, [siteKey, containerId, resetKey])

  return (
    <div className="flex justify-center overflow-x-auto">
      <div id={containerId} />
    </div>
  )
}
