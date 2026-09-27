'use client'

// Dev instrumentation, not part of the exercise: shows live Web Vitals for the
// current document so you can compare before/after your fixes.
// Values are approximations (CLS is summed without session windows, INP is the
// slowest interaction so far). Final values are logged by useReportWebVitals.

import { useEffect, useState } from 'react'
import { useReportWebVitals } from 'next/web-vitals'

type MetricName = 'TTFB' | 'FCP' | 'LCP' | 'CLS' | 'INP'

const THRESHOLDS: Record<MetricName, [good: number, poor: number]> = {
  TTFB: [800, 1800],
  FCP: [1800, 3000],
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
}

type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean }
type EventTimingEntry = PerformanceEntry & { interactionId?: number }

const logMetric: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  const value = metric.name === 'CLS' ? metric.value.toFixed(3) : `${Math.round(metric.value)}ms`
  console.log(`[web-vitals] ${metric.name} ${value} (${metric.rating})`)
}

function rating(name: MetricName, value: number) {
  const [good, poor] = THRESHOLDS[name]
  if (value <= good) return 'good'
  return value <= poor ? 'needs-improvement' : 'poor'
}

function format(name: MetricName, value: number) {
  return name === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`
}

export function VitalsHUD() {
  useReportWebVitals(logMetric)
  const [vitals, setVitals] = useState<Partial<Record<MetricName, number>>>({})

  useEffect(() => {
    const record = (name: MetricName, value: number) => setVitals((current) => ({ ...current, [name]: value }))
    const observers: PerformanceObserver[] = []
    const observe = (type: string, onEntries: (entries: PerformanceEntry[]) => void, options = {}) => {
      try {
        const observer = new PerformanceObserver((list) => onEntries(list.getEntries()))
        observer.observe({ type, buffered: true, ...options })
        observers.push(observer)
      } catch {
        // Entry type not supported in this browser.
      }
    }

    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navigation) record('TTFB', navigation.responseStart)

    observe('paint', (entries) => {
      const fcp = entries.find((entry) => entry.name === 'first-contentful-paint')
      if (fcp) record('FCP', fcp.startTime)
    })
    observe('largest-contentful-paint', (entries) => {
      const last = entries.at(-1)
      if (last) record('LCP', last.startTime)
    })

    let cls = 0
    observe('layout-shift', (entries) => {
      for (const entry of entries as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) cls += entry.value
      }
      record('CLS', cls)
    })

    let slowest = 0
    observe(
      'event',
      (entries) => {
        for (const entry of entries as EventTimingEntry[]) {
          if (entry.interactionId && entry.duration > slowest) {
            slowest = entry.duration
            record('INP', slowest)
          }
        }
      },
      { durationThreshold: 16 },
    )

    return () => observers.forEach((observer) => observer.disconnect())
  }, [])

  return (
    <aside className="hud" aria-label="Web Vitals for this page load">
      <strong>Web Vitals</strong>
      {(Object.keys(THRESHOLDS) as MetricName[]).map((name) => {
        const value = vitals[name]
        return (
          <div key={name} className="hud__row" data-rating={value === undefined ? undefined : rating(name, value)}>
            <span>{name}</span>
            <span>{value === undefined ? '—' : format(name, value)}</span>
          </div>
        )
      })}
    </aside>
  )
}
