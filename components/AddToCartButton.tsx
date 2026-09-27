'use client'

import { useState } from 'react'

export function AddToCartButton({ productId }: { productId: string }) {
  const [added, setAdded] = useState(false)

  function handleClick() {
    window.legacyAnalytics?.trackSync('add_to_cart', { productId })

    const cart: { productId: string; addedAt: number }[] = JSON.parse(localStorage.getItem('cart') ?? '[]')
    cart.push({ productId, addedAt: Date.now() })
    localStorage.setItem('cart', JSON.stringify(cart))

    setAdded(true)
  }

  return (
    <button type="button" className="btn" onClick={handleClick}>
      {added ? 'Added to cart ✓' : 'Add to cart'}
    </button>
  )
}
