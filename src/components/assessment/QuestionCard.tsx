'use client'
import { cn } from '@/lib/utils'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import Button from '@/components/ui/Button'

export type QuestionStatus = 'unanswered' | 'answered' | 'flagged'

interface QuestionCardProps {
  questionNumber: number
  text: string
  options: { id: string; text: string; label: string }[]
  selectedOption?: string
  onSelect?: (id: string) => void
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
  flaggedForReview,
  onToggleFlag,
  readOnly,
  showResult,
  correctOption,
  explanation,
  compact = false,
}: QuestionCardProps) {
  return (
    <div className={cn('w-full mx-auto flex flex-col min-h-0', compact ? 'max-w-none h-full' : 'max-w-3xl space-y-6')}>
      <div className={cn('flex justify-between items-start shrink-0', compact ? 'gap-2 mb-2' : '')}>
        <h2 className={cn('font-semibold text-slate-800', compact ? 'text-base' : 'text-xl')}>
          Questão {questionNumber}
        </h2>
        {onToggleFlag && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFlag}
            className={cn(
              'flex items-center gap-1.5 shrink-0',
              flaggedForReview ? 'text-yellow-600 hover:text-yellow-700' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {flaggedForReview ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            <span className="hidden sm:inline text-sm">
              {flaggedForReview ? 'Revisar' : 'Marcar'}
            </span>
          </Button>
        )}
      </div>

      <div
        className={cn(
          'text-slate-700 leading-snug whitespace-pre-wrap shrink-0',
          compact ? 'text-sm sm:text-base mb-2' : 'text-lg leading-relaxed'
        )}
      >
        {text}
      </div>

      <div
        className={cn(
          'flex flex-col min-h-0',
          compact ? 'gap-1.5 flex-1 overflow-y-auto overscroll-contain' : 'space-y-3 pt-4'
        )}
      >
        {options.map((option) => {
          const isSelected = selectedOption === option.id
          const isCorrect = showResult && correctOption === option.id
          const isWrongSelection = showResult && isSelected && !isCorrect

          return (
            <button
              key={option.id}
              onClick={() => !readOnly && onSelect && onSelect(option.id)}
              disabled={readOnly}
              className={cn(
                'w-full flex items-center text-left transition-all duration-200 border-2 rounded-lg',
                compact ? 'px-3 py-2 sm:py-2.5' : 'p-4',
                !readOnly && 'hover:bg-slate-50 cursor-pointer',
                isSelected && !showResult && 'border-blue-500 bg-blue-50',
                !isSelected && !showResult && 'border-slate-200',
                isCorrect && 'border-green-500 bg-green-50',
                isWrongSelection && 'border-red-500 bg-red-50',
                readOnly && !isSelected && !isCorrect && 'border-slate-200 opacity-60'
              )}
            >
              <div
                className={cn(
                  'rounded-full flex items-center justify-center font-bold shrink-0 border-2',
                  compact ? 'w-7 h-7 text-sm mr-3' : 'w-8 h-8 mr-4',
                  isSelected && !showResult && 'border-blue-500 text-blue-500',
                  !isSelected && !showResult && 'border-slate-300 text-slate-500',
                  isCorrect && 'border-green-500 text-green-500 bg-green-100',
                  isWrongSelection && 'border-red-500 text-red-500 bg-red-100',
                  readOnly && !isSelected && !isCorrect && 'border-slate-300 text-slate-400'
                )}
              >
                {option.label}
              </div>
              <span className={cn('text-slate-700', compact ? 'text-sm sm:text-[15px] leading-snug' : 'text-lg')}>
                {option.text}
              </span>
            </button>
          )
        })}
      </div>

      {showResult && explanation && (
        <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Explicação:</h3>
          <p className="text-blue-800 whitespace-pre-wrap">{explanation}</p>
        </div>
      )}
    </div>
  )
}
