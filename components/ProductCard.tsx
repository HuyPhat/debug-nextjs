import Link from 'next/link'
import moment from 'moment'
import type { Product } from '@/lib/types'
import { Price } from './Price'

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.id}`} className="card">
      <img src={product.image} alt={product.name} className="card__img" />
      <div className="card__body">
        <h3>{product.name}</h3>
        <Price amount={product.price} />
        <small>
          {product.category} · added {moment(product.createdAt).fromNow()}
        </small>
      </div>
    </Link>
  )
}
