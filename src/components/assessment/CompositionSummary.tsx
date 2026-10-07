import { Clock, HelpCircle, PenLine } from 'lucide-react'

type Props = {
  mcCount: number | null
  discursiveCount: number | null
  mcWeightPercent: number | null
  discursiveWeightPercent: number | null
  timeLimitMinutes: number
  /** Cor de destaque dos ícones (classes Tailwind) */
  accentClassName?: string
  passingScore?: number | null
  showPassingHint?: boolean
}

export default function CompositionSummary({
  mcCount,
  discursiveCount,
  mcWeightPercent,
  discursiveWeightPercent,
  timeLimitMinutes,
  accentClassName = 'text-accent',
  passingScore = null,
  showPassingHint = false,
}: Props) {
  const mc = mcCount ?? 0
  const disc = discursiveCount ?? 0
  const total = mc + disc
  const mcWeight = mcWeightPercent ?? 0
  const discWeight = discursiveWeightPercent ?? 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-100">
          <HelpCircle className={`w-6 h-6 shrink-0 ${accentClassName}`} />
          <div className="min-w-0 leading-snug">
            <div className="font-semibold text-slate-800">
              {mc} múltipla escolha
            </div>
            <div className="text-sm text-slate-500">Peso na nota: {mcWeight}%</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-100">
          <PenLine className={`w-6 h-6 shrink-0 ${accentClassName}`} />
          <div className="min-w-0 leading-snug">
            <div className="font-semibold text-slate-800">
              {disc} discursiva{disc === 1 ? '' : 's'}
            </div>
            <div className="text-sm text-slate-500">
              {disc > 0 ? `Peso na nota: ${discWeight}%` : 'Não entram nesta avaliação'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-100">
          <Clock className={`w-6 h-6 shrink-0 ${accentClassName}`} />
          <div className="min-w-0 leading-snug">
            <div className="font-semibold text-slate-800">Duração</div>
            <div className="text-sm text-slate-500">
              {timeLimitMinutes} minutos (cronometrado)
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-slate-600">
        Total: <span className="font-medium text-slate-800">{total} questões</span>
        {showPassingHint && passingScore != null ? (
          <>
            {' '}
            · Nota mínima para aprovação:{' '}
            <span className="font-medium text-slate-800">{passingScore}%</span>
          </>
        ) : null}
      </p>
    </div>
  )
}
