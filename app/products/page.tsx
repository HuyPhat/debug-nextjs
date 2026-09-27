import type { Metadata } from 'next'
import { ProductExplorer } from '@/components/ProductExplorer'
import { RenderedAt } from '@/components/RenderedAt'
import { apiGet } from '@/lib/api'
import type { Product } from '@/lib/types'

export const metadata: Metadata = {
  title: 'All products | Hydra Store',
}

export default async function ProductsPage() {
  const products = await apiGet<Product[]>('/api/products')

  return (
    <>
      <h1>All products</h1>
      <ProductExplorer products={products} />
      <RenderedAt />
    </>
  )
}
