import { getProducts } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const products = await getProducts()

  if (searchParams.get('featured')) {
    return Response.json(products.slice(0, 8))
  }
  return Response.json(products)
}
