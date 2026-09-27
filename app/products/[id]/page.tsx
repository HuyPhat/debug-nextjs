import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddToCartButton } from '@/components/AddToCartButton'
import { Price } from '@/components/Price'
import { ProductCard } from '@/components/ProductCard'
import { RenderedAt } from '@/components/RenderedAt'
import { ViewersNow } from '@/components/ViewersNow'
import { getProduct, getRelatedProducts } from '@/lib/db'

export async function generateMetadata({ params }: PageProps<'/products/[id]'>): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)
  return {
    title: product ? `${product.name} | Hydra Store` : 'Product not found | Hydra Store',
    description: product?.description,
  }
}

export default async function ProductPage({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  return (
    <>
      <article className="product">
        <img src={product.image} alt={product.name} className="product__img" />
        <div className="product__info">
          <p className="product__category">{product.category}</p>
          <h1>{product.name}</h1>
          <Price amount={product.price} />
          <ViewersNow />
          <p className="product__description">
            {product.description}
            <div className="product__specs">
              <span>Rating {product.rating} / 5</span>
              <span>{product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}</span>
            </div>
          </p>
          <AddToCartButton productId={product.id} />
        </div>
      </article>

      <RelatedProducts id={id} />
      <RenderedAt />
    </>
  )
}

async function RelatedProducts({ id }: { id: string }) {
  const product = await getProduct(id)
  if (!product) return null
  const related = await getRelatedProducts(product.category, product.id)

  return (
    <section>
      <h2>You may also like</h2>
      <div className="grid">
        {related.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  )
}
