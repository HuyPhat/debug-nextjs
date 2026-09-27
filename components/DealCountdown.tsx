'use client'

import { useEffect, useState } from 'react'

function endOfToday() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return end
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function DealCountdown() {
  const endsAt = endOfToday()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <p className="deal">
      Flash sale ends at <time dateTime={endsAt.toISOString()}>{endsAt.toLocaleTimeString()}</time> —{' '}
      <strong>{formatDuration(endsAt.getTime() - now)}</strong> left
    </p>
  )
}
