'use client'
import { cn } from '@/lib/utils'

export interface QuestionStatus {
  id: string
  number: number
  isAnswered: boolean
  isFlagged: boolean
}

interface QuestionGridProps {
  questions: QuestionStatus[]
  currentIndex: number
  onSelect: (index: number) => void
  compact?: boolean
}

export function QuestionGrid({ questions, currentIndex, onSelect, compact = false }: QuestionGridProps) {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 shadow-sm flex flex-col min-h-0',
        compact ? 'p-2.5 rounded-lg h-full' : 'p-4 rounded-xl'
      )}
    >
      <h3
        className={cn(
          'font-semibold text-slate-700 text-center sm:text-left shrink-0',
          compact ? 'mb-2 text-sm' : 'mb-4'
        )}
      >
        Mapa de Questões
      </h3>
      <div
        className={cn(
          'grid min-h-0',
          compact
            ? 'grid-cols-5 gap-1 content-start overflow-y-auto'
            : 'grid-cols-5 sm:grid-cols-4 md:grid-cols-5 gap-2'
        )}
      >
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex

          return (
            <button
              key={q.id}
              onClick={() => onSelect(idx)}
              className={cn(
                'w-full rounded-md flex items-center justify-center font-medium transition-all',
                compact ? 'aspect-square text-xs' : 'aspect-square text-sm',
                isCurrent && 'ring-2 ring-blue-500 ring-offset-1 scale-105',
                !q.isAnswered && !q.isFlagged && 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                q.isAnswered && !q.isFlagged && 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                q.isFlagged && 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
              )}
              title={
                q.isFlagged
                  ? `Questão ${q.number} (Revisar)`
                  : q.isAnswered
                    ? `Questão ${q.number} (Respondida)`
                    : `Questão ${q.number}`
              }
            >
              {q.number}
            </button>
          )
        })}
      </div>
      <div
        className={cn(
          'flex text-slate-500 shrink-0',
          compact ? 'mt-2 gap-3 text-[10px] flex-wrap' : 'mt-4 flex-col gap-2 text-xs'
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200" />
          <span>Vazia</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-100" />
          <span>Respondida</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-100 border border-yellow-300" />
          <span>Revisão</span>
        </div>
      </div>
    </div>
  )
}
