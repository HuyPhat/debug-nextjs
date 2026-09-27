import { headers } from 'next/headers'

// Server-side helper to call our own REST API. Builds an absolute URL from the
// incoming request so it works on any port / domain.
export async function apiGet<T>(path: string): Promise<T> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'

  const response = await fetch(`${protocol}://${host}${path}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}
