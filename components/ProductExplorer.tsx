'use client'

import { useState } from 'react'
import _ from 'lodash'
import type { Product } from '@/lib/types'
import { ProductCard } from './ProductCard'

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'rating'

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

// Fuzzy relevance: 1 for a prefix match, lower the more typos it takes to match a word.
function relevance(product: Product, query: string) {
  const words = `${product.name} ${product.category} ${product.description}`.toLowerCase().split(/\W+/)
  let bestDistance = Infinity
  for (const word of words) {
    const distance = word.startsWith(query) ? 0 : levenshtein(query, word)
    bestDistance = Math.min(bestDistance, distance)
  }
  return 1 / (1 + bestDistance)
}

export function ProductExplorer({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortKey>('featured')

  const normalizedQuery = query.trim().toLowerCase()
  const categories = ['All', ..._.uniq(products.map((product) => product.category)).sort()]

  const results = _.cloneDeep(products)
    .filter((product) => category === 'All' || product.category === category)
    .filter((product) => !normalizedQuery || relevance(product, normalizedQuery) >= 0.5)
    .sort((a, b) => {
      if (normalizedQuery) return relevance(b, normalizedQuery) - relevance(a, normalizedQuery)
      switch (sort) {
        case 'price-asc':
          return a.price - b.price
        case 'price-desc':
          return b.price - a.price
        case 'newest':
          return b.createdAt.localeCompare(a.createdAt)
        case 'rating':
          return b.rating - a.rating
        default:
          return 0
      }
    })

  return (
    <div className="explorer">
      <div className="explorer__controls">
        <input
          type="search"
          placeholder={`Search ${products.length} products…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search products"
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort by">
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
      <p className="explorer__count">{results.length} products</p>
      <div className="grid">
        {results.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
