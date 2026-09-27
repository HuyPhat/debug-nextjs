export type Currency = 'VND' | 'USD'

export type Product = {
  id: string
  name: string
  category: string
  description: string
  price: number // stored in VND
  image: string
  rating: number
  stock: number
  createdAt: string
}

export type Post = {
  slug: string
  title: string
  excerpt: string
  author: string
  publishedAt: string
  body: string[]
}

export type Profile = {
  name: string
  isGuest: boolean
  memberSince?: string
}

export type Promo = {
  title: string
  subtitle: string
  code: string
}
