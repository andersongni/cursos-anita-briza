'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { formatDurationMs } from '@/lib/exercises/typing'

type Props = {
  passageId: string
  title: string
  content: string
  onComplete: (result: {
    passageId: string
    durationMs: number
    errorCount: number
  }) => void
  submitting?: boolean
}

export default function TypingPractice({
  passageId,
  title,
  content,
  onComplete,
  submitting = false,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const errorCountRef = useRef(0)
  const finishedRef = useRef(false)
  const typedRef = useRef('')
  const [typed, setTyped] = useState('')
  const [errorCount, setErrorCount] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [finished, setFinished] = useState(false)

  const correctPrefixLen = useMemo(() => {
    let i = 0
    while (i < typed.length && typed[i] === content[i]) i++
    return i
  }, [typed, content])

  const progress = content.length ? correctPrefixLen / content.length : 0
  const hasErrors = typed.length > correctPrefixLen

  useEffect(() => {
    inputRef.current?.focus()
  }, [passageId])

  useEffect(() => {
    if (finished || startedAtRef.current == null) return
    const id = window.setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedMs(Date.now() - startedAtRef.current)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [finished, typed])

  const forceCaretToEnd = useCallback(() => {
    const el = inputRef.current
    if (!el || finishedRef.current) return
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [])

  const finishIfDone = useCallback(
    (value: string) => {
      if (value !== content || finishedRef.current) return
      finishedRef.current = true
      const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0
      setFinished(true)
      setElapsedMs(durationMs)
      onComplete({
        passageId,
        durationMs,
        errorCount: errorCountRef.current,
      })
    },
    [content, onComplete, passageId]
  )

  const applyValue = useCallback(
    (rawValue: string) => {
      if (finishedRef.current || finished || submitting) return

      const prev = typedRef.current
      let value = rawValue.slice(0, content.length)

      // Só permite acrescentar no fim ou apagar do fim (Backspace) — bloqueia edição no meio
      if (value.length > prev.length) {
        if (!value.startsWith(prev)) value = prev
      } else if (value.length < prev.length) {
        // Trata qualquer redução como Backspace(s) a partir do fim
        value = prev.slice(0, value.length)
      } else if (value !== prev) {
        value = prev
      }

      if (!startedAtRef.current && value.length > 0) {
        startedAtRef.current = Date.now()
      }

      // Cada caractere digitado após (ou no) primeiro desalinhamento conta como erro
      if (value.length > prev.length) {
        for (let i = prev.length; i < value.length; i++) {
          const prefixMatches = value.slice(0, i) === content.slice(0, i)
          if (!prefixMatches || value[i] !== content[i]) {
            errorCountRef.current += 1
          }
        }
        setErrorCount(errorCountRef.current)
      }

      typedRef.current = value
      setTyped(value)
      requestAnimationFrame(forceCaretToEnd)
      finishIfDone(value)
    },
    [content, finishIfDone, finished, forceCaretToEnd, submitting]
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return
    applyValue(e.target.value)
  }

  const handleMouseNav = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    inputRef.current?.focus()
    forceCaretToEnd()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const navKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ]
    if (navKeys.includes(e.key)) {
      e.preventDefault()
      forceCaretToEnd()
      return
    }
    // Evita selecionar tudo e editar o meio do texto
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Texto da prática</p>
          <h2 className="text-xl font-bold text-secondary">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-500">Tempo </span>
            <span className="font-semibold text-secondary tabular-nums">
              {formatDurationMs(elapsedMs)}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-500">Erros </span>
            <span className="font-semibold text-secondary tabular-nums">{errorCount}</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-500">Progresso </span>
            <span className="font-semibold text-secondary tabular-nums">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div
        role="textbox"
        aria-label="Área de digitação"
        tabIndex={0}
        onMouseDown={(e) => {
          // Clique na área só foca — não reposiciona o cursor no texto
          e.preventDefault()
          inputRef.current?.focus()
          forceCaretToEnd()
        }}
        className={`relative rounded-xl border-2 bg-white p-5 sm:p-6 shadow-sm cursor-text transition-colors select-none ${
          hasErrors ? 'border-error' : 'border-slate-200 focus-within:border-primary'
        }`}
      >
        <p className="font-mono text-lg sm:text-xl leading-relaxed whitespace-pre-wrap break-words select-none pointer-events-none">
          {content.split('').map((char, index) => {
            let className = 'text-slate-400'
            let displayChar = char

            if (index < typed.length) {
              if (index < correctPrefixLen) {
                className = 'text-primary'
                displayChar = char
              } else {
                className = 'bg-red-200 text-red-800'
                // Mostra o que foi digitado (espaço vira ponto médio)
                displayChar = typed[index] === ' ' ? '·' : typed[index]
              }
            } else if (index === typed.length) {
              className = 'bg-brand-gold/40 text-secondary'
              displayChar = char === ' ' ? '\u00a0' : char
            }

            return (
              <span key={`${index}-${char}`} className={className}>
                {displayChar}
              </span>
            )
          })}
        </p>

        <textarea
          ref={inputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={finished || submitting}
          rows={3}
          className="absolute inset-0 opacity-0 caret-transparent resize-none select-none"
          value={typed}
          onChange={handleChange}
          onMouseDown={handleMouseNav}
          onClick={handleMouseNav}
          onSelect={forceCaretToEnd}
          onKeyDown={handleKeyDown}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false
            applyValue(e.currentTarget.value)
          }}
          aria-label="Digite o texto mostrado acima"
        />
      </div>

      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>

      <p className="text-sm text-slate-600">
        Digite só pelo teclado — o mouse não move o cursor no texto. Se errar, os caracteres ficam em
        vermelho e você pode continuar; para corrigir, use <strong>Backspace</strong> até o ponto do
        erro. Cada caractere errado conta na precisão e na nota.
      </p>

      {!finished && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            inputRef.current?.focus()
          }}
        >
          Focar no texto
        </Button>
      )}
    </div>
  )
}
