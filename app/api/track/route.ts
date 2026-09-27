export const dynamic = 'force-dynamic'

// Collector endpoint for the analytics snippet in /public/vendor/analytics.js.
export async function POST(request: Request) {
  const event = await request.json().catch(() => null)
  await new Promise((resolve) => setTimeout(resolve, 250))
  console.log('[track]', event?.type ?? 'unknown')
  return new Response(null, { status: 204 })
}
