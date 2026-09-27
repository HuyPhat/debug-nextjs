import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Customers complained about seeing old prices after a sale ended.
// Make sure browsers and CDNs never keep a copy of anything we serve.
export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('x-request-path', request.nextUrl.pathname)

  return response
}
