export {}

declare global {
  interface Window {
    legacyAnalytics?: {
      trackSync: (event: string, properties?: Record<string, unknown>) => void
    }
  }
}
