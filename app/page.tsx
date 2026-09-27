import Link from 'next/link'
import { DealCountdown } from '@/components/DealCountdown'
import { ProductCard } from '@/components/ProductCard'
import { RenderedAt } from '@/components/RenderedAt'
import { apiGet } from '@/lib/api'
import type { Product } from '@/lib/types'

export default async function HomePage() {
  const featured = await apiGet<Product[]>('/api/products?featured=1')

  return (
    <>
      <section className="hero">
        <img src="/images/hero.png" alt="Linen shirts drying in the sun" className="hero__img" loading="lazy" />
        <div className="hero__copy">
          <h1>Made slowly, in Saigon.</h1>
          <p>Breathable clothes for a humid city. Cut, sewn and finished by eleven people we know by name.</p>
          <DealCountdown />
          <Link href="/products" className="btn">
            Shop the collection
          </Link>
        </div>
      </section>

      <section>
        <h2>Featured this week</h2>
        <div className="grid">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <RenderedAt />
    </>
  )
}
