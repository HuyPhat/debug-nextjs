import type { Promo } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  // The promo service is slow; it has to check the campaign calendar.
  await new Promise((resolve) => setTimeout(resolve, 800))

  const promo: Promo = {
    title: 'Mid-autumn sale — 20% off everything',
    subtitle: 'Free delivery in Ho Chi Minh City and Hanoi for orders over 500.000 ₫.',
    code: 'TRUNGTHU20',
  }
  return Response.json(promo)
}
