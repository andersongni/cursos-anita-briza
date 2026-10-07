'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useFontScale } from '@/hooks/useFontScale'

export type QuestionStatus = 'unanswered' | 'answered' | 'flagged'

interface QuestionCardProps {
  questionNumber: number
  text: string
  options: { id: string; text: string; label: string }[]
  selectedOption?: string
  onSelect?: (id: string) => void
  format?: 'MULTIPLE_CHOICE' | 'DISCURSIVE'
  textAnswer?: string
  onTextAnswerChange?: (value: string) => void
  flaggedForReview?: boolean
  onToggleFlag?: () => void
  readOnly?: boolean
  showResult?: boolean
  correctOption?: string
  explanation?: string
  /** Layout mais denso para caber na viewport na execução */
  compact?: boolean
}

export function QuestionCard({
  questionNumber,
  text,
  options,
  selectedOption,
  onSelect,
  format = 'MULTIPLE_CHOICE',
  textAnswer = '',
  onTextAnswerChange,
  flaggedForReview,
  onToggleFlag,
  readOnly,
  showResult,
  correctOption,
  explanation,
  compact = false,
}: QuestionCardProps) {
  const { scale } = useFontScale()
  const rootRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)

  // Ajusta levemente o tamanho para caber na altura disponível (sem scroll da página)
  useEffect(() => {
    if (!compact) {
      setFit(1)
      return
    }
    const el = rootRef.current
    if (!el) return

    const measure = () => {
      const h = el.clientHeight
      if (h <= 0) return

      const baseTitle = 17 * scale
      const baseQuestion = 17 * scale
      const baseOption = 16 * scale
      const n = Math.max(options.length, 1)

      // altura estimada: título + enunciado (~até 3 linhas) + N alternativas
      const estimated =
        baseTitle * 1.35 +
        8 +
        baseQuestion * 1.35 * Math.min(3, Math.ceil(text.length / 70) || 2) +
        8 +
        n * (baseOption * 1.35 + 14)

      const ratio = estimated > 0 ? h / estimated : 1
      // Mantém legível: no mínimo 72% da escala escolhida
      setFit(Math.min(1, Math.max(0.72, ratio)))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact, scale, options.length, text])

  const display = scale * (compact ? fit : 1)
  const titlePx = Math.round((compact ? 16 : 20) * display)
  const questionPx = Math.round((compact ? 16 : 18) * display)
  const optionPx = Math.round((compact ? 15 : 18) * display)
  const labelPx = Math.round(14 * display)
  const optionBox = Math.max(22, Math.round(28 * display))
  const dense = compact && display >= 1.2

  if (!compact) {
    return (
      <div className="w-full mx-auto max-w-3xl space-y-6">
        <div className="flex justify-between items-start">
          <h2
            className="font-semibold text-slate-800"
            style={{ fontSize: `${titlePx}px`, lineHeight: 1.3 }}
          >
            Questão {questionNumber}
          </h2>
          {onToggleFlag && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFlag}
              className={cn(
                'flex items-center gap-1.5 shrink-0',
                flaggedForReview
                  ? 'text-yellow-600 hover:text-yellow-700'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {flaggedForReview ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-sm">
                {flaggedForReview ? 'Revisar' : 'Marcar'}
              </span>
            </Button>
          )}
        </div>
        <div
          className="text-slate-700 whitespace-pre-wrap"
          style={{ fontSize: `${questionPx}px`, lineHeight: 1.45 }}
        >
          {text}
        </div>
        {format === 'DISCURSIVE' ? (
          <div className="pt-4 space-y-2">
            <label className="block text-sm font-medium text-slate-600">
              Sua resposta
            </label>
            <textarea
              className="w-full min-h-[140px] rounded-lg border-2 border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-50"
              style={{ fontSize: `${optionPx}px`, lineHeight: 1.45 }}
              value={textAnswer}
              disabled={readOnly}
              placeholder="Digite sua resposta aqui..."
              onChange={(e) => onTextAnswerChange?.(e.target.value)}
            />
          </div>
        ) : (
        <div className="space-y-3 pt-4">
          {options.map((option) => {
            const isSelected = selectedOption === option.id
            const isCorrect = showResult && correctOption === option.id
            const isWrongSelection = showResult && isSelected && !isCorrect
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !readOnly && onSelect && onSelect(option.id)}
                disabled={readOnly}
                className={cn(
                  'w-full flex items-center text-left transition-all duration-200 border-2 rounded-lg p-4',
                  !readOnly && 'hover:bg-slate-50 cursor-pointer',
                  isSelected && !showResult && 'border-primary bg-sky-50',
                  !isSelected && !showResult && 'border-slate-200',
                  isCorrect && 'border-green-500 bg-green-50',
                  isWrongSelection && 'border-red-500 bg-red-50',
                  readOnly && !isSelected && !isCorrect && 'border-slate-200 opacity-60'
                )}
              >
                <div
                  className={cn(
                    'rounded-full flex items-center justify-center font-bold shrink-0 border-2 mr-4',
                    isSelected && !showResult && 'border-primary text-primary',
                    !isSelected && !showResult && 'border-slate-300 text-slate-500',
                    isCorrect && 'border-green-500 text-green-500 bg-green-100',
                    isWrongSelection && 'border-red-500 text-red-500 bg-red-100'
                  )}
                  style={{
                    width: `${optionBox}px`,
                    height: `${optionBox}px`,
                    fontSize: `${labelPx}px`,
                  }}
                >
                  {option.label}
                </div>
                <span
                  className="text-slate-700"
                  style={{ fontSize: `${optionPx}px`, lineHeight: 1.4 }}
                >
                  {option.text}
                </span>
              </button>
            )
          })}
        </div>
        )}
        {showResult && explanation && (
          <div className="mt-6 p-4 rounded-lg bg-sky-50 border border-sky-200">
            <h3 className="font-semibold text-secondary mb-2" style={{ fontSize: `${titlePx}px` }}>
              {format === 'DISCURSIVE' ? 'Comentário:' : 'Explicação:'}
            </h3>
            <p
              className="text-slate-700 whitespace-pre-wrap"
              style={{ fontSize: `${optionPx}px`, lineHeight: 1.45 }}
            >
              {explanation}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="w-full h-full min-h-0 flex flex-col overflow-hidden">
      <div className={cn('flex justify-between items-center shrink-0', dense ? 'mb-1' : 'mb-1.5')}>
        <h2
          className="font-semibold text-slate-800 truncate"
          style={{ fontSize: `${titlePx}px`, lineHeight: 1.2 }}
        >
          Questão {questionNumber}
        </h2>
        {onToggleFlag && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFlag}
            className={cn(
              'flex items-center gap-1 shrink-0 h-8 px-2',
              flaggedForReview
                ? 'text-yellow-600 hover:text-yellow-700'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {flaggedForReview ? (
              <BookmarkCheck className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-xs">
              {flaggedForReview ? 'Revisar' : 'Marcar'}
            </span>
          </Button>
        )}
      </div>

      <div
        className="text-slate-700 whitespace-pre-wrap shrink-0 min-h-0 overflow-hidden"
        style={{
          fontSize: `${questionPx}px`,
          lineHeight: 1.3,
          maxHeight: dense ? '22%' : '26%',
        }}
      >
        {text}
      </div>

      {format === 'DISCURSIVE' ? (
        <div className="flex flex-col flex-1 min-h-0 mt-1.5">
          <textarea
            className="w-full flex-1 min-h-[8rem] rounded-lg border-2 border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-50 resize-none"
            style={{ fontSize: `${optionPx}px`, lineHeight: 1.35 }}
            value={textAnswer}
            disabled={readOnly}
            placeholder="Digite sua resposta aqui..."
            onChange={(e) => onTextAnswerChange?.(e.target.value)}
          />
        </div>
      ) : (
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0 overflow-hidden',
          dense ? 'gap-1 mt-1' : 'gap-1.5 mt-1.5'
        )}
      >
        {options.map((option) => {
          const isSelected = selectedOption === option.id
          const isCorrect = showResult && correctOption === option.id
          const isWrongSelection = showResult && isSelected && !isCorrect

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !readOnly && onSelect && onSelect(option.id)}
              disabled={readOnly}
              className={cn(
                'w-full flex-1 min-h-0 flex items-center text-left transition-all duration-150 border-2 rounded-lg overflow-hidden',
                dense ? 'px-2 py-1' : 'px-2.5 py-1.5',
                !readOnly && 'hover:bg-slate-50 cursor-pointer',
                isSelected && !showResult && 'border-primary bg-sky-50',
                !isSelected && !showResult && 'border-slate-200',
                isCorrect && 'border-green-500 bg-green-50',
                isWrongSelection && 'border-red-500 bg-red-50',
                readOnly && !isSelected && !isCorrect && 'border-slate-200 opacity-60'
              )}
            >
              <div
                className={cn(
                  'rounded-full flex items-center justify-center font-bold shrink-0 border-2 mr-2',
                  isSelected && !showResult && 'border-primary text-primary',
                  !isSelected && !showResult && 'border-slate-300 text-slate-500',
                  isCorrect && 'border-green-500 text-green-500 bg-green-100',
                  isWrongSelection && 'border-red-500 text-red-500 bg-red-100',
                  readOnly && !isSelected && !isCorrect && 'border-slate-300 text-slate-400'
                )}
                style={{
                  width: `${optionBox}px`,
                  height: `${optionBox}px`,
                  fontSize: `${labelPx}px`,
                }}
              >
                {option.label}
              </div>
              <span
                className="text-slate-700 min-w-0 flex-1 overflow-hidden"
                style={{
                  fontSize: `${optionPx}px`,
                  lineHeight: 1.25,
                  display: '-webkit-box',
                  WebkitLineClamp: dense ? 2 : 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {option.text}
              </span>
            </button>
          )
        })}
      </div>
      )}
    </div>
  )
}
