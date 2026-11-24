import { buildMouseAccuracyPerformance } from '@/lib/exercises/mouse-accuracy'

type Props = {
  hits: number
  misses: number
  expired: number
  durationMs: number
  /** Extras opcionais (placar ao vivo). */
  points?: number
  comboLabel?: string
  timeLabel?: string
  timeEmphasize?: boolean
  className?: string
}

export default function MouseAccuracyPerformance({
  hits,
  misses,
  expired,
  durationMs,
  points,
  comboLabel,
  timeLabel,
  timeEmphasize,
  className,
}: Props) {
  const perf = buildMouseAccuracyPerformance({
    hits,
    misses,
    expired,
    durationMs,
  })

  return (
    <div className={className}>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Desempenho
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-2xl font-bold tabular-nums text-secondary">
              {perf.targets}{' '}
              <span className="text-base font-semibold text-slate-600">
                {perf.targets === 1 ? 'alvo' : 'alvos'}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600 tabular-nums">
              {perf.targetHits} acertos · {perf.notHit} não acertados · {perf.targetRate}
            </p>
          </div>

          <div>
            <p className="text-2xl font-bold tabular-nums text-secondary">
              {perf.clicks}{' '}
              <span className="text-base font-semibold text-slate-600">
                {perf.clicks === 1 ? 'clique' : 'cliques'}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600 tabular-nums">
              {perf.clickHits} acertos · {perf.clickMisses} erros · {perf.clickRate}
            </p>
          </div>
        </div>
      </div>

      {(points != null || comboLabel || timeLabel) && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {points != null ? <MiniStat label="Pontos" value={String(points)} /> : null}
          {comboLabel ? <MiniStat label="Sequência" value={comboLabel} /> : null}
          {timeLabel ? (
            <MiniStat label="Tempo" value={timeLabel} emphasize={timeEmphasize} />
          ) : null}
        </div>
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center ${
        emphasize ? 'border-brand-gold bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-secondary">{value}</div>
    </div>
  )
}
