import type { Post, Product } from './types'

// Seeded PRNG so the catalogue is identical on every boot.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260927)
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]

const ADJECTIVES = ['Relaxed', 'Classic', 'Everyday', 'Weekend', 'Urban', 'Coastal', 'Heritage', 'Minimal', 'Rugged', 'Soft']
const MATERIALS = ['Linen', 'Cotton', 'Wool', 'Leather', 'Denim', 'Canvas', 'Silk', 'Bamboo', 'Suede', 'Hemp']
const CATEGORIES = {
  Shirts: ['Shirt', 'Overshirt', 'Polo', 'Tee'],
  Shoes: ['Sneaker', 'Loafer', 'Boot', 'Sandal'],
  Bags: ['Tote', 'Backpack', 'Duffel', 'Crossbody'],
  Outerwear: ['Jacket', 'Parka', 'Blazer', 'Coat'],
  Accessories: ['Scarf', 'Cap', 'Belt', 'Wallet'],
  Home: ['Throw', 'Cushion', 'Apron', 'Blanket'],
} as const

const SENTENCES = [
  'Cut from breathable fabric that softens with every wash.',
  'Designed in Saigon and made in small batches by our partner workshop.',
  'A versatile piece that works from the office to a late dinner by the river.',
  'Reinforced seams and hand-finished details for years of daily wear.',
  'Garment-dyed for a lived-in colour that ages beautifully.',
  'Lightweight enough for monsoon season, warm enough for air-conditioned offices.',
  'Pairs well with almost everything already in your wardrobe.',
  'Packed in recycled paper with zero single-use plastic.',
  'Each piece is inspected by hand before it leaves the studio.',
  'Relaxed through the body with a slightly cropped length.',
]

const CATALOGUE_SIZE = 600
const BASE_DATE = Date.UTC(2026, 8, 1)
const DAY = 24 * 60 * 60 * 1000

export const PRODUCTS: Product[] = Array.from({ length: CATALOGUE_SIZE }, (_, index) => {
  const category = pick(Object.keys(CATEGORIES)) as keyof typeof CATEGORIES
  const noun = pick(CATEGORIES[category])
  const name = `${pick(ADJECTIVES)} ${pick(MATERIALS)} ${noun}`
  const description = Array.from({ length: 3 }, () => pick(SENTENCES)).join(' ')
  return {
    id: `p-${String(index + 1).padStart(3, '0')}`,
    name,
    category,
    description,
    price: (Math.floor(rand() * 90) + 10) * 29_000,
    image: `/images/products/p-${(index % 12) + 1}.png`,
    rating: Math.round((3 + rand() * 2) * 10) / 10,
    stock: Math.floor(rand() * 40),
    createdAt: new Date(BASE_DATE - Math.floor(rand() * 400) * DAY).toISOString(),
  }
})

export const POSTS: Post[] = [
  {
    slug: 'caring-for-linen',
    title: 'How to care for linen in a humid climate',
    excerpt: 'Linen loves Saigon weather — as long as you treat it right. Five habits that keep it looking good.',
    author: 'Mai Tran',
    publishedAt: '2026-03-14T02:00:00.000Z',
    body: [
      'Linen is the most forgiving fabric you can own in a tropical city. It breathes, it dries quickly and it looks better with a few wrinkles.',
      'Wash it cold and inside out, skip the tumble dryer and hang it in the shade. Direct sun fades natural dyes faster than any detergent.',
      'Store it folded, not hung, during the rainy season. Hangers stretch the shoulders when the fibres are heavy with humidity.',
      'Finally: iron while slightly damp, or not at all. A relaxed look is the whole point.',
    ],
  },
  {
    slug: 'behind-the-workshop',
    title: 'Behind the workshop: a day with our makers',
    excerpt: 'We spent a day with the eleven people who cut, sew and finish every piece in our collection.',
    author: 'Quang Le',
    publishedAt: '2026-05-02T02:00:00.000Z',
    body: [
      'The workshop starts at 7am, before the heat. Pattern pieces are cut by hand in stacks of twelve.',
      'Every sewer owns a garment from start to finish, which means every piece has a name attached to it.',
      'Quality control happens twice: once at the machine, once at the packing table.',
    ],
  },
  {
    slug: 'capsule-wardrobe',
    title: 'Building a 12-piece capsule wardrobe',
    excerpt: 'Twelve pieces, forty outfits. Our stylist explains how to build a wardrobe that works harder.',
    author: 'Linh Pham',
    publishedAt: '2026-06-20T02:00:00.000Z',
    body: [
      'Start with neutrals you actually wear. Look at the last month of outfits, not your Pinterest board.',
      'Add texture before colour: a linen shirt and a wool overshirt in the same shade read as two very different pieces.',
      'Finish with one statement item per season. That is the piece people will remember.',
    ],
  },
  {
    slug: 'monsoon-packing-list',
    title: 'The monsoon packing list',
    excerpt: 'Travelling in the rainy season? Here is what we actually pack, and what stays home.',
    author: 'Mai Tran',
    publishedAt: '2026-07-11T02:00:00.000Z',
    body: [
      'A packable shell beats an umbrella on a motorbike every time.',
      'Canvas sneakers dry overnight; leather does not. Leave the loafers at home.',
      'Bring one more shirt than you think you need. Humidity is undefeated.',
    ],
  },
]
