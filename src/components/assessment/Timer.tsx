'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface TimerProps {
  deadline: string
  onTimeUp: () => void
}

export function Timer({ deadline, onTimeUp }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const firedRef = useRef(false)
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp

  useEffect(() => {
    firedRef.current = false
    const end = new Date(deadline).getTime()

    const calculateTimeLeft = () => {
      return Math.max(0, end - Date.now())
    }

    const remaining = calculateTimeLeft()
    setTimeLeft(remaining)

    // Se já expirou ao montar, avisa uma vez (sem loop)
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true
        onTimeUpRef.current()
      }
      return
    }

    const timer = setInterval(() => {
      const next = calculateTimeLeft()
      setTimeLeft(next)
      if (next <= 0) {
        clearInterval(timer)
        if (!firedRef.current) {
          firedRef.current = true
          onTimeUpRef.current()
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [deadline])

  if (timeLeft === null) return <div>--:--:--</div>

  const hours = Math.floor(timeLeft / (1000 * 60 * 60))
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)

  const isLowTime = hours === 0 && minutes < 5
  const isCriticalTime = hours === 0 && minutes < 1

  return (
    <div
      className={cn(
        'font-mono text-base sm:text-lg font-bold flex items-center px-2 py-1 rounded-md transition-colors tabular-nums',
        isLowTime && !isCriticalTime && 'text-red-500 animate-pulse',
        isCriticalTime && 'text-red-600 animate-pulse bg-red-100',
        !isLowTime && !isCriticalTime && 'text-slate-800 bg-slate-100'
      )}
    >
      {hours.toString().padStart(2, '0')}:
      {minutes.toString().padStart(2, '0')}:
      {seconds.toString().padStart(2, '0')}
    </div>
  )
}
