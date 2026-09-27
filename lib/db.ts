import { POSTS, PRODUCTS } from './data'
import type { Profile } from './types'

// Pretend database client. Latencies roughly match what we see from the
// production database in Singapore when called from our Saigon servers.
let queryCount = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function query<T>(label: string, latencyMs: number, run: () => T): Promise<T> {
  const id = ++queryCount
  const startedAt = Date.now()
  await sleep(latencyMs)
  console.log(`[db] #${id} ${label} took ${Date.now() - startedAt}ms`)
  return run()
}

export function getProducts() {
  return query('products.findMany()', 900, () => PRODUCTS)
}

export function getProduct(id: string) {
  return query(`products.findUnique(${id})`, 700, () => PRODUCTS.find((product) => product.id === id) ?? null)
}

export function getRelatedProducts(category: string, excludeId: string) {
  return query(`products.findRelated(${category})`, 500, () =>
    PRODUCTS.filter((product) => product.category === category && product.id !== excludeId).slice(0, 4),
  )
}

export function getPosts() {
  return query('posts.findMany()', 600, () => POSTS)
}

export function getPost(slug: string) {
  return query(`posts.findUnique(${slug})`, 600, () => POSTS.find((post) => post.slug === slug) ?? null)
}

export function getProfile(name: string | undefined) {
  return query('profiles.findUnique()', 300, (): Profile =>
    name ? { name, isGuest: false, memberSince: '2025-11-02' } : { name: 'guest', isGuest: true },
  )
}
