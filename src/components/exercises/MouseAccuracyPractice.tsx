'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from '@/components/ui/Button'
import {
  MOUSE_ACCURACY_COUNTDOWN_SECONDS,
  MOUSE_ACCURACY_DURATION_MS,
  MOUSE_ACCURACY_EXPIRE_PENALTY,
  MOUSE_ACCURACY_INITIAL_TARGETS,
  MOUSE_ACCURACY_MAX_TARGETS,
  MOUSE_ACCURACY_MISS_PENALTY,
  MOUSE_ACCURACY_TARGET_LIFETIME_MS,
  MOUSE_ACCURACY_TARGET_MAX_PX,
  comboMultiplier,
  computeMouseAccuracyStats,
  pointsForHit,
  spawnGapMs,
  targetScaleAtAge,
} from '@/lib/exercises/mouse-accuracy'

type Phase = 'countdown' | 'playing' | 'finished'

type Target = {
  id: number
  x: number
  y: number
  bornAt: number
}

export type MouseAccuracyResult = {
  hits: number
  misses: number
  expired: number
  points: number
  maxCombo: number
  durationMs: number
  reactionSumMs: number
}

type Props = {
  onComplete: (result: MouseAccuracyResult) => void
  /** Sai sem salvar (Esc / abortar). */
  onAbort: () => void
  submitting?: boolean
  onPlayAgain?: () => void
}

function pickSpawnPoint(
  arena: HTMLDivElement,
  existing: Target[]
): { x: number; y: number } {
  const rect = arena.getBoundingClientRect()
  const pad = MOUSE_ACCURACY_TARGET_MAX_PX / 2 + 8
  const width = Math.max(pad * 2 + 10, rect.width)
  const height = Math.max(pad * 2 + 10, rect.height)
  const minDist = MOUSE_ACCURACY_TARGET_MAX_PX * 0.85

  for (let attempt = 0; attempt < 18; attempt++) {
    const x = pad + Math.random() * (width - pad * 2)
    const y = pad + Math.random() * (height - pad * 2)
    const farEnough = existing.every((t) => {
      const dx = t.x - x
      const dy = t.y - y
      return dx * dx + dy * dy >= minDist * minDist
    })
    if (farEnough) return { x, y }
  }

  return {
    x: pad + Math.random() * (width - pad * 2),
    y: pad + Math.random() * (height - pad * 2),
  }
}

export default function MouseAccuracyPractice({
  onComplete,
  onAbort,
  submitting,
  onPlayAgain,
}: Props) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('countdown')
  const [targets, setTargets] = useState<Target[]>([])
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [expired, setExpired] = useState(0)
  const [points, setPoints] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [remainingMs, setRemainingMs] = useState(MOUSE_ACCURACY_DURATION_MS)
  const [countdownSec, setCountdownSec] = useState(MOUSE_ACCURACY_COUNTDOWN_SECONDS)
  const [portalReady, setPortalReady] = useState(false)
  const [, setFrame] = useState(0)

  const hitsRef = useRef(0)
  const missesRef = useRef(0)
  const expiredRef = useRef(0)
  const pointsRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const reactionSumRef = useRef(0)
  const targetsRef = useRef<Target[]>([])
  const phaseRef = useRef<Phase>('countdown')
  const startAtRef = useRef(0)
  const endAtRef = useRef(0)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextIdRef = useRef(1)
  const lastSpawnAtRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const abortedRef = useRef(false)

  const syncTargets = (next: Target[]) => {
    targetsRef.current = next
    setTargets(next)
  }

  const clearCountdownTimer = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  const stopLoop = () => {
    clearCountdownTimer()
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const abort = useCallback(() => {
    if (abortedRef.current || finishedRef.current) return
    if (phaseRef.current === 'finished') return
    abortedRef.current = true
    finishedRef.current = true
    stopLoop()
    syncTargets([])
    onAbort()
  }, [onAbort])

  const finish = useCallback(() => {
    if (finishedRef.current || abortedRef.current) return
    finishedRef.current = true
    phaseRef.current = 'finished'
    setPhase('finished')
    stopLoop()
    syncTargets([])
    const durationMs = Math.min(
      MOUSE_ACCURACY_DURATION_MS,
      Math.max(MOUSE_ACCURACY_DURATION_MS - 500, Date.now() - startAtRef.current)
    )
    onComplete({
      hits: hitsRef.current,
      misses: missesRef.current,
      expired: expiredRef.current,
      points: pointsRef.current,
      maxCombo: maxComboRef.current,
      durationMs,
      reactionSumMs: reactionSumRef.current,
    })
  }, [onComplete])

  const spawnTarget = useCallback(() => {
    const arena = arenaRef.current
    if (!arena || phaseRef.current !== 'playing') return
    if (targetsRef.current.length >= MOUSE_ACCURACY_MAX_TARGETS) return

    const point = pickSpawnPoint(arena, targetsRef.current)
    const next: Target = {
      id: nextIdRef.current++,
      x: point.x,
      y: point.y,
      bornAt: performance.now(),
    }
    syncTargets([...targetsRef.current, next])
    lastSpawnAtRef.current = performance.now()
  }, [])

  const spawnInitialTargets = useCallback(() => {
    const count = Math.min(MOUSE_ACCURACY_INITIAL_TARGETS, MOUSE_ACCURACY_MAX_TARGETS)
    for (let i = 0; i < count; i++) {
      spawnTarget()
    }
  }, [spawnTarget])

  useEffect(() => {
    if (phase !== 'playing') return

    const tick = () => {
      const nowWall = Date.now()
      const left = Math.max(0, endAtRef.current - nowWall)
      setRemainingMs(left)
      if (left <= 0) {
        finish()
        return
      }

      const now = performance.now()
      const previous = targetsRef.current
      const alive = previous.filter(
        (t) => now - t.bornAt < MOUSE_ACCURACY_TARGET_LIFETIME_MS
      )
      const expiredCount = previous.length - alive.length
      if (expiredCount > 0) {
        expiredRef.current += expiredCount
        pointsRef.current -= expiredCount * MOUSE_ACCURACY_EXPIRE_PENALTY
        comboRef.current = 0
        setExpired(expiredRef.current)
        setPoints(pointsRef.current)
        setCombo(0)
        syncTargets(alive)
      }

      const elapsedMs = Math.max(0, nowWall - startAtRef.current)
      if (
        alive.length < MOUSE_ACCURACY_MAX_TARGETS &&
        now - lastSpawnAtRef.current >= spawnGapMs(elapsedMs)
      ) {
        spawnTarget()
      }

      setFrame((n) => n + 1)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [phase, finish, spawnTarget])

  useEffect(() => {
    return () => {
      clearCountdownTimer()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      abort()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abort])

  const beginPlaying = useCallback(() => {
    if (abortedRef.current || finishedRef.current) return
    startAtRef.current = Date.now()
    endAtRef.current = startAtRef.current + MOUSE_ACCURACY_DURATION_MS
    setRemainingMs(MOUSE_ACCURACY_DURATION_MS)
    phaseRef.current = 'playing'
    setPhase('playing')
    requestAnimationFrame(() => {
      spawnInitialTargets()
    })
  }, [spawnInitialTargets])

  useLayoutEffect(() => {
    phaseRef.current = 'countdown'
    setCountdownSec(MOUSE_ACCURACY_COUNTDOWN_SECONDS)
    let remaining = MOUSE_ACCURACY_COUNTDOWN_SECONDS
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearCountdownTimer()
        setCountdownSec(0)
        beginPlaying()
        return
      }
      setCountdownSec(remaining)
    }, 1000)
    return () => clearCountdownTimer()
  }, [beginPlaying])

  const registerMiss = () => {
    missesRef.current += 1
    pointsRef.current -= MOUSE_ACCURACY_MISS_PENALTY
    comboRef.current = 0
    setMisses(missesRef.current)
    setPoints(pointsRef.current)
    setCombo(0)
  }

  const registerHit = (targetId: number, ageMs: number) => {
    const nextCombo = comboRef.current + 1
    comboRef.current = nextCombo
    maxComboRef.current = Math.max(maxComboRef.current, nextCombo)
    hitsRef.current += 1
    reactionSumRef.current += Math.max(0, ageMs)
    pointsRef.current += pointsForHit(nextCombo, ageMs)
    setHits(hitsRef.current)
    setPoints(pointsRef.current)
    setCombo(nextCombo)
    setMaxCombo(maxComboRef.current)
    syncTargets(targetsRef.current.filter((t) => t.id !== targetId))
  }

  const handleArenaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'playing') return
    e.preventDefault()

    const arena = arenaRef.current
    if (!arena) return
    const rect = arena.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const now = performance.now()

    let hitId: number | null = null
    let hitAgeMs = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (const target of targetsRef.current) {
      const ageMs = now - target.bornAt
      const scale = Math.max(0.12, targetScaleAtAge(now - target.bornAt))
      const radius = (MOUSE_ACCURACY_TARGET_MAX_PX / 2) * scale
      const dx = px - target.x
      const dy = py - target.y
      const dist = dx * dx + dy * dy
      if (dist <= radius * radius && dist < bestDist) {
        bestDist = dist
        hitId = target.id
        hitAgeMs = ageMs
      }
    }

    if (hitId != null) {
      registerHit(hitId, hitAgeMs)
    } else {
      registerMiss()
    }
  }

  const secondsLeft = Math.ceil(remainingMs / 1000)
  const multiplier = comboMultiplier(combo)
  const preview = computeMouseAccuracyStats({
    hits,
    misses,
    expired,
    points,
    durationMs: MOUSE_ACCURACY_DURATION_MS,
    maxCombo,
  })
  const nowAnim = performance.now()
  const comboLabel = `${combo} (×${multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)})`

  const shell = (
    <div
      className="fixed inset-0 z-[200] flex h-dvh w-screen flex-col overflow-hidden bg-slate-50"
      role="dialog"
      aria-modal="true"
      aria-label="Partida de precisão do mouse"
    >
      <div
        className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-4"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-secondary">Precisão do mouse</p>
            <p className="text-xs text-slate-500">
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-700">
                Esc
              </kbd>{' '}
              sair sem salvar
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-slate-600 sm:text-sm">
            <span>
              <strong className="text-secondary">{points}</strong> pts
            </span>
            <span>
              Seq. <strong className="text-secondary">{comboLabel}</strong>
            </span>
            <span
              className={
                phase === 'playing' && secondsLeft <= 5
                  ? 'font-bold text-amber-700'
                  : undefined
              }
            >
              <strong className="text-secondary">{secondsLeft}s</strong>
            </span>
            <span>
              {hits} acertos · {misses} erros · {expired} sumiram
            </span>
          </div>
        </div>
      </div>

      <div
        ref={arenaRef}
        onPointerDown={handleArenaPointerDown}
        className="relative min-h-0 w-full flex-1 overflow-hidden bg-gradient-to-br from-sky-50 via-white to-sky-100 select-none touch-none"
        style={{ cursor: 'default' }}
        role="application"
        aria-label="Área do exercício de precisão do mouse"
      >
        {phase === 'countdown' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 px-6 text-center backdrop-blur-[1px]">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Preparar
            </p>
            <p className="text-7xl font-bold tabular-nums text-primary sm:text-8xl">
              {countdownSec}
            </p>
            <p className="text-sm text-slate-600">O primeiro alvo aparece em breve</p>
            <p className="text-xs text-slate-500 mt-2">Pressione Esc para cancelar</p>
          </div>
        )}

        {phase === 'playing' &&
          targets.map((target) => {
            const scale = Math.max(0.08, targetScaleAtAge(nowAnim - target.bornAt))
            return (
              <button
                key={target.id}
                type="button"
                aria-label="Alvo"
                tabIndex={-1}
                className="absolute rounded-full border-4 border-white shadow-lg pointer-events-none"
                style={{
                  width: MOUSE_ACCURACY_TARGET_MAX_PX,
                  height: MOUSE_ACCURACY_TARGET_MAX_PX,
                  left: target.x,
                  top: target.y,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  background: 'var(--primary)',
                  boxShadow:
                    combo >= 5
                      ? '0 0 0 3px var(--brand-gold), 0 8px 20px rgba(10, 74, 110, 0.35)'
                      : '0 8px 20px rgba(10, 74, 110, 0.28)',
                }}
              />
            )
          })}

        {phase === 'finished' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/75 px-6 text-center backdrop-blur-[1px]">
            <p className="text-xl font-bold text-secondary sm:text-2xl">Tempo esgotado</p>
            <p className="text-sm text-slate-700">
              Pontos {preview.points} · Bônus de precisão +{preview.accuracyBonus} · Nota{' '}
              {preview.score}
            </p>
            {submitting ? (
              <p className="text-sm text-slate-500">Salvando resultado…</p>
            ) : onPlayAgain ? (
              <Button variant="primary" onClick={onPlayAgain}>
                Jogar novamente
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )

  if (!portalReady) {
    return <div className="h-dvh w-full overflow-hidden bg-slate-50" aria-hidden />
  }

  return createPortal(shell, document.body)
}

