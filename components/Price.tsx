'use client'

import { usePreferences } from './PreferencesProvider'

const RATES = { VND: 1, USD: 1 / 25_000 } as const

export function Price({ amount }: { amount: number }) {
  const { currency } = usePreferences()
  const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount * RATES[currency])

  return <span className="price">{formatted}</span>
}
