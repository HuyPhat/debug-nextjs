'use client'

import { useEffect, useState } from 'react'

export function ViewersNow() {
  const [viewers, setViewers] = useState(() => 5 + Math.floor(Math.random() * 40))

  useEffect(() => {
    const timer = setInterval(() => {
      setViewers((current) => Math.max(1, current + Math.round(Math.random() * 4 - 2)))
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return <p className="viewers">{viewers} people are looking at this right now</p>
}
