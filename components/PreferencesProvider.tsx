'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Currency } from '@/lib/types'

const PreferencesContext = createContext<{ currency: Currency }>({ currency: 'VND' })

export function PreferencesProvider({ currency, children }: { currency: Currency; children: ReactNode }) {
  return <PreferencesContext value={{ currency }}>{children}</PreferencesContext>
}

export function usePreferences() {
  return useContext(PreferencesContext)
}
