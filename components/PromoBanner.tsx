'use client'

import { useEffect, useState } from 'react'
import type { Promo } from '@/lib/types'

export function PromoBanner() {
  const [promo, setPromo] = useState<Promo | null>(null)

  useEffect(() => {
    fetch('/api/promo')
      .then((response) => response.json())
      .then(setPromo)
      .catch(() => setPromo(null))
  }, [])

  if (!promo) return null

  return (
    <section className="promo-banner">
      <div className="container">
        <strong>{promo.title}</strong>
        <p>{promo.subtitle}</p>
        <p>
          Use code <code>{promo.code}</code> at checkout.
        </p>
      </div>
    </section>
  )
}
