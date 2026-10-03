# Solutions (spoilers)

> These are **proposals, not applied fixes**. The code in the repo is still broken on purpose. Snippets are sketches for Next.js 16.3 / React 19.2. Adapt them; don't paste blindly.

## Suggested order of attack

Fixes interact, so the order matters:

1. **K1: stop the proxy from stamping `no-store` on everything.** Otherwise you can't observe any caching work you do later.
2. **H1–H5: hydration.** Text mismatches make React re-render the whole tree on the client, which **hides** other bugs (the theme bug on `/`) and **creates** new ones (H6, images downloaded twice).
3. **R: rendering plan per route**, together with K3 (data layer) and the personalization redesign. These are the same change.
4. **C: Core Web Vitals.** Many improve on their own after steps 1–3. Then tackle the image, script, CLS, INP and bundle issues.
5. **Verify** with the checklist at the end.

## Target rendering plan

| Route | Today | Target | Reasoning |
|-------|-------|--------|-----------|
| `/about` | ƒ | **○ Static (SSG)** | Never changes |
| `/blog` | ƒ | **○ Static + revalidate** (tag `posts`) | Changes when an editor publishes |
| `/blog/[slug]` | ƒ | **● SSG** via `generateStaticParams`, `dynamicParams` on for new posts | Same content for everyone; SEO-critical |
| `/` | ƒ | **ISR** (featured products, `revalidate` ≈ 5 min) **or ◐ PPR** | Same for everyone except the greeting |
| `/products` | ƒ | **ISR** (tag `products`) | SEO-critical listing; search/filter runs on the client over cached data |
| `/products/[id]` | ƒ | **● ISR**: top-N via `generateStaticParams` + on-demand `revalidateTag('product:<id>')` | SEO-critical; price freshness comes from **tags**, not `no-store` |
| `/account` | ƒ | **ƒ Dynamic** (keep it) | Per user; must never be shared-cached |
| `/api/products` | ƒ | **Delete** (call the data layer directly), or make it a cacheable GET if external clients need it | |
| `/api/promo` | ƒ | Fold into the server render (cached), or a GET with `s-maxage` | Same campaign for everyone |
| `/api/track` | ƒ | ƒ (a POST, correctly dynamic) | |

Personalization moves out of the root layout (see R3): the greeting becomes a client island or a PPR hole, and currency becomes a cacheable variant.

---

## R: One rendering mode

### R1. Three independent reasons everything is `ƒ`

| # | Cause | Where |
|---|-------|-------|
| a | Segment config forcing dynamic for the whole tree: `dynamic = 'force-dynamic'`, `revalidate = 0`, `fetchCache = 'force-no-store'` | `app/layout.tsx:12-14` |
| b | `await cookies()` **in the root layout**. In the previous caching model, a request-time API anywhere in the layout makes every route under it dynamic | `app/layout.tsx:22` |
| c | `apiGet()` calls `await headers()` (another request-time API) and `fetch(..., { cache: 'no-store' })` against the app's own route handler | `lib/api.ts:6,10`, used by `app/page.tsx:9`, `app/products/page.tsx:12` |

Removing only (a) changes nothing in the build output, because (b) and (c) still force dynamic rendering. That's the trap.

**Proposal.** Delete (a). Resolve (b) with R3. Replace (c) by calling the data layer directly from Server Components (below). The self-fetch also **breaks `next build` the moment the page becomes static**, because no server is listening at build time.

```ts
// lib/queries.ts (previous caching model)
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import * as db from './db'

export const getProducts = unstable_cache(db.getProducts, ['products'], { tags: ['products'], revalidate: 300 })

// Cached across requests, and deduplicated within a request (see K3).
export const getProduct = cache((id: string) =>
  unstable_cache(() => db.getProduct(id), ['product', id], { tags: ['products', `product:${id}`], revalidate: 300 })(),
)
```

Or, with **Cache Components** (`cacheComponents: true`, the Next 16 direction):

```ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('minutes')
  cacheTag('products')
  return db.getProducts()
}
```

With Cache Components you must also **remove** every `dynamic` / `revalidate` / `fetchCache` export (they're not allowed in that mode). `RenderedAt` uses `new Date()`, which Cache Components makes you handle explicitly: wrap it in `'use cache'` (it then shows the cache-fill time, which is what you want to see) or put it behind `connection()` inside `<Suspense>`.

### R2. Static content re-rendered per request

- `/blog/[slug]` and `/products/[id]` have no `generateStaticParams`, so nothing is prerendered.
- Add `export async function generateStaticParams() { return (await getPosts()).map(({ slug }) => ({ slug })) }`. For products, prerender the top N (best sellers) and let the rest be generated on first request (`dynamicParams` defaults to `true`), then cached.
- Previous model: `export const revalidate = 300` on product pages. Cache Components: `cacheLife` on the data.

### R3. Personalization without making every page dynamic

The layout reads two cookies. They have very different shapes, so they get different fixes:

**Greeting (`name`): high cardinality, cosmetic.** Take it off the critical path.

- **Option A, client island (previous model):** render a stable placeholder on the server, then fill it in after hydration. `useSyncExternalStore` with a server snapshot is the idiomatic hydration-safe way to read browser-only values:

  ```tsx
  'use client'
  import { useSyncExternalStore } from 'react'

  const subscribe = () => () => {}
  const readName = () => document.cookie.match(/(?:^|; )name=([^;]*)/)?.[1] ?? null

  export function Greeting() {
    const name = useSyncExternalStore(subscribe, readName, () => null) // null on server AND during hydration
    return <span className="greeting">Hi, {name ? decodeURIComponent(name) : 'there'}</span> // CSS: reserve width
  }
  ```

- **Option B, PPR hole (Cache Components):** keep it a Server Component, but put it inside `<Suspense>` so only this hole is dynamic and the rest of the layout joins the static shell:

  ```tsx
  <Suspense fallback={<span className="greeting">Hi, …</span>}>
    <Greeting /> {/* async: const name = (await cookies()).get('name')?.value */}
  </Suspense>
  ```

  `getProfile()` (300 ms) then only delays the hole, not every page's TTFB.

**Currency: low cardinality (2 values), and it changes the main content (prices).** Make it a **cacheable variant** instead of per-request state:

- Put it in the URL (`/usd/products/p-001`, `app/[currency]/...` with `generateStaticParams` → `vnd`, `usd`), or keep clean URLs and have `proxy.ts` **rewrite** to the variant based on the cookie. Each variant is static.
- Caveat: a CDN in front of the origin must not cache the public URL for both variants. Either run the rewrite at the edge before the cache (the Next docs recommend proxy runs before the CDN cache) or keep the currency visible in the URL.
- Bonus: `Price` can then become a Server Component. No hydration, so no mismatch (H4 disappears).

### R4. What stays dynamic, and why not "just go CSR"

`/account` should stay `ƒ`. It's per user and Next already sends `private, no-cache, no-store` for it. Making the catalogue CSR (fetch in `useEffect`) would ship empty HTML to crawlers and link previews, and push LCP behind a JS → fetch → render waterfall. Use CSR for **islands** (viewers-now, cart badge, greeting), not for primary content.

---

## H: Hydration mismatches

A shared helper for "render this only after hydration":

```ts
// lib/use-hydrated.ts
import { useSyncExternalStore } from 'react'
const subscribe = () => () => {}
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false)
```

### H1. `DealCountdown` (`components/DealCountdown.tsx`)

Three causes in one component:

1. `useState(() => Date.now())` (line 21): the server's "now" is ~1–2 s older than the browser's, so the seconds differ.
2. `end.setHours(23, 59, 59, 999)` (line 7): "end of today" in the **server's** time zone (UTC) vs the **browser's** (UTC+7). That's a 7-hour difference in the countdown and in `dateTime`.
3. `toLocaleTimeString()` (line 30): server locale vs browser locale.

**Proposal:**

- The deal end is **business data**. Compute it once on the server as an absolute instant (e.g. midnight `Asia/Ho_Chi_Minh`, or `promo.endsAt` from the DB) and pass it as an ISO string prop.
- Format the end time with a pinned locale and time zone: `new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })`. If you want the *user's* local time, use the inline-script technique from the Next guide _Preventing flash before hydration_ (`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`).
- Render the ticking part only after hydration, as a fixed-width placeholder (`--:--:--` with `font-variant-numeric: tabular-nums`) until `useHydrated()` is true. Server and first client render then match, and there's no layout shift.
- `suppressHydrationWarning` on the `<strong>` is acceptable **only** for the ticking text itself, and it's still worse than the placeholder.

### H2. `<div>` inside `<p>` (`app/products/[id]/page.tsx:33-35`)

The HTML parser auto-closes `<p>` when it meets `<div>`. The DOM the browser builds no longer matches React's tree, so hydration fails. **Fix:** make the wrapper a `<div>` (or turn the specs into `<span>`s, or a `<dl>`/`<ul>` placed after the paragraph).

### H3. `ViewersNow` (`components/ViewersNow.tsx:6`)

`Math.random()` in the initial state produces different values on the server and the client. **Fix:** it's a per-visitor, real-time widget with no SEO value. Render a same-height placeholder until `useHydrated()`, then fetch the real number (or pass a server-provided initial value as a prop). Never generate random values during render. Use `useId()` for ids.

### H4. `Price` (`components/Price.tsx:9`)

`new Intl.NumberFormat(undefined, …)` uses the **runtime's default locale**: Node's (from `LANG`) on the server, `navigator.language` in the browser. `₫2,755,000` ≠ `2.755.000 ₫`.

**Fix:** pin the locale per currency (`VND → 'vi-VN'`, `USD → 'en-US'`), or pass the locale chosen on the server (from a cookie or `Accept-Language`) through context so both sides use the same value. Hoist the formatters to module scope; constructing an `Intl.NumberFormat` per render is expensive across 600 cards (C4). With currency as a route variant (R3), `Price` can be a Server Component and the problem disappears.

```ts
const FORMATTERS = {
  VND: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
}
```

### H5. `ThemeToggle` (`components/ThemeToggle.tsx:9,23`)

- The lazy initializer reads `localStorage` on the client (`dark`) but returns `light` on the server, so `className`, `aria-label` and `title` differ.
- React 19 **doesn't patch attribute mismatches** (dev warning only, nothing in production). The button keeps the server's "light" icon and label while the effect makes the page dark.
- On `/` and product pages it *looks* fine only because H1/H2/H3 force a full client re-render. Fix those and the theme bug shows up there too.
- Applying the theme in `useEffect` causes a flash of the light theme on every load.

**Fix, as in the Next "Preventing flash" guide:**

1. Add a tiny **inline blocking script** in `<head>` that sets `document.documentElement.dataset.theme` from `localStorage` / `prefers-color-scheme` before first paint. Put `suppressHydrationWarning` on `<html>`, because the script legitimately changes its attributes.
2. Make the button's markup **theme-agnostic**: a constant `aria-label="Toggle dark mode"`, with the icon chosen by CSS (`html[data-theme='dark'] .theme-toggle::before { content: '☀' }`). On click, read and flip `document.documentElement.dataset.theme` and persist it.
3. Alternative: store the theme in a cookie and render it on the server. That's correct, but it's personalization on the server, so it brings back R3's cost (dynamic rendering). Prefer 1 + 2.

### H6. Images downloaded twice

This is a consequence of H1–H3 plus K2. The text mismatch makes React discard the server DOM and re-create it; the new `<img>` elements re-request their images, and because they're served `no-store` the browser downloads them again (verified: hero requested at 1237 ms and again at 1404 ms, 2 ms after the hydration error). Fixing either side removes it. Fix both.

### Diagnosis toolkit used here

`pnpm dev:utc` (`TZ=UTC LANG=en_US.UTF-8`) · DevTools → Sensors (locale + time zone) · dev overlay diff · `view-source:` vs Elements · disable JS · prod error `#418` with `args[]=text`.

---

## C: Core Web Vitals

### C1. LCP: the hero image (`app/page.tsx:14`, `next.config.ts:6`, `app/globals.css:169`)

Problems: a 2.2 MB PNG, `loading="lazy"` **on the LCP element** (so the preload scanner can't start it early), no `width`/`height`, no `srcset`/`sizes`, no preload or `fetchpriority`, image optimization disabled (`images.unoptimized: true`), and it's downloaded twice (H6). The hero also sits **behind a 1.2 s data fetch**, because the page awaits the featured products before returning any markup.

```tsx
import Image from 'next/image'
import hero from '@/public/images/hero.png' // static import: intrinsic size + content-hashed, immutable URL

<Image src={hero} alt="Linen shirts drying in the sun" preload placeholder="blur"
       sizes="(max-width: 1120px) 100vw, 1088px" className="hero__img" />
```

- Next 16 renamed `priority` to **`preload`** (`priority` is deprecated).
- Remove `images.unoptimized`, and consider `images.formats: ['image/avif', 'image/webp']`.
- Move the featured products into `<Suspense>` (or cache them) so the hero is in the first HTML flush. Keep LCP elements **outside** Suspense boundaries.
- Product cards: `<Image width={900} height={900} sizes="(max-width: 600px) 50vw, 220px" …>` serves a resized WebP/AVIF of a few tens of KB instead of a 760 KB PNG for a 220 px box.

### C2. TTFB / FCP

Server:

- Self-fetch → call the data layer directly (R1c).
- **Waterfall** on the product page: `generateMetadata` → page → `RelatedProducts` each `await getProduct()` (700 ms each), then `getRelatedProducts`. Fix with `React.cache` (K3), start independent work in parallel (`Promise.all` or the preload pattern), and stream `RelatedProducts` inside `<Suspense>` with a size-matched skeleton.
- The layout awaits `getProfile()` (300 ms) before sending anything, on every page (R3).
- Once pages are static or ISR, TTFB is a cache hit and most of this disappears.

Browser:

- `app/layout.tsx:29`: a **parser-blocking** `<script src>` as the first thing in `<head>`. `public/vendor/analytics.js:9` then makes a **synchronous XHR** that waits 250 ms for `/api/track` before the parser can continue. Every page's FCP/LCP pays for it.
- Fix: load with `next/script` and `strategy="afterInteractive"` (or `lazyOnload`), and replace sync XHR with `navigator.sendBeacon('/api/track', body)` or `fetch(url, { method: 'POST', body, keepalive: true })`.

### C3. CLS ≈ 0.8

- `PromoBanner` (`components/PromoBanner.tsx:9-16`) renders `null`, fetches `/api/promo` (800 ms) **after hydration**, then inserts a ~150 px block *above* the page content. The promo is the same for everyone, so render it on the server as part of the cached shell (`getPromo()` with `revalidate` / `cacheLife('minutes')`). If it must stay client-side, reserve its height (`min-height`) or render it as an overlay (`position: fixed`), which doesn't shift layout.
- Images with no reserved space (`.hero__img`, `.card__img`, `.product__img` use `height: auto` with no `width`/`height` attributes). `next/image` with dimensions fixes this, or use CSS `aspect-ratio: 16 / 9` and `1 / 1`.
- Suspense skeletons you add in C2 must match the final size, or you trade TTFB for CLS.

### C4. INP

**Search on `/products`** (`components/ProductExplorer.tsx`). One keystroke:

1. `_.cloneDeep` of 600 products (line 43), which isn't needed because nothing is mutated.
2. Recomputes Levenshtein relevance **inside the sort comparator** (line 47): `O(n log n)` scoring, twice per comparison, with the text re-tokenised every time.
3. Re-renders up to 600 cards, each constructing an `Intl.NumberFormat` and calling `moment().fromNow()`, and each `<Link>` setting up viewport prefetching. There's no virtualization and no memoization.
4. All of it happens synchronously in the urgent update for the `<input>`.

Proposal:

```tsx
const deferredQuery = useDeferredValue(query) // keep typing urgent, the list non-urgent
const index = useMemo(() => products.map((p) => ({ p, words: tokenize(p) })), [products]) // tokenise once
const results = useMemo(() => {
  const scored = index.map(({ p, words }) => ({ p, score: score(words, deferredQuery) })) // score once per item
  return scored.filter(/* … */).sort((a, b) => b.score - a.score).map(({ p }) => p)
}, [index, deferredQuery, category, sort])
// + memo(ProductCard) or a memoized <ResultsGrid>
// + virtualize (@tanstack/react-virtual) or paginate / "load more"
```

Also: pass the client only the fields it needs (not 600 full descriptions; precompute search tokens on the server). For very large catalogues, move search to the server (`searchParams`, which makes that route dynamic, or a search API).

**Add to cart** (`components/AddToCartButton.tsx:9` → `public/vendor/analytics.js:9`): the click waits for a **synchronous XHR** (≈ 250 ms) before React can paint "Added". Update the UI first, then send analytics with `sendBeacon` or after yielding (`setTimeout(…, 0)`, `scheduler.yield()` where supported, or `requestIdleCallback`).

### C5. Payload

- `moment` pulls in **140 locales** (a single 392 KB chunk shared with full `lodash`) on `/products`. Replace `fromNow()` with `Intl.RelativeTimeFormat` or a tree-shakable `date-fns` function. Better still, render an absolute date on the server with a pinned locale: relative "x ago" text is also time-dependent, so it's a potential hydration mismatch.
- `lodash`: use native `new Set()` for `uniq` and drop `cloneDeep` entirely. If you really need lodash, use per-method imports (`lodash-es`).
- Verify with `pnpm exec next experimental-analyze` (the Turbopack bundle analyzer).
- The 429 KB HTML comes from 600 SSR'd cards plus the same 600 products serialised again in the RSC payload. Paginate, and send only the card fields.

---

## K: Caching

### K1. `proxy.ts`: `no-store` on every response

It has no `matcher`, so it runs for **every request**, including `/_next/static/*`, where it **replaces the `public, max-age=31536000, immutable` header** on content-hashed chunks (verified with `curl`). It also costs a proxy invocation per asset. Once you make pages static, it would likely override the `s-maxage` Next sets for them too, so check with `curl -I` after each change.

**Fix:** delete the header logic (Next already sends the right `Cache-Control` for each rendering mode: static → `s-maxage=31536000`; ISR → `s-maxage=N, stale-while-revalidate=…`; dynamic → `private, no-cache, no-store, …`). If the proxy is still needed for something else (e.g. the currency rewrite in R3), scope it:

```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|images|vendor|favicon.ico).*)'],
}
```

The original complaint ("customers saw old prices") is a **freshness** problem. Solve it with tag-based invalidation (below), not by disabling caching. Side note: `no-store` on HTML documents has historically also made pages ineligible for the browser's back/forward cache.

### K2. Static files and images (`next.config.ts`)

- Remove the `no-store` headers for `/images/:path*` and `/vendor/:path*`.
- Prefer **static imports** or `next/image` for images. Static imports give hashed, `immutable` URLs; `next/image` gives optimised variants cached for `images.minimumCacheTTL`. For files that marketing swaps in place, use versioned filenames, or a short `max-age` with `stale-while-revalidate`.
- Remove `images.unoptimized: true`.

### K3. Data layer: no memoization, no data cache, a self-fetch

- `getProduct(id)` runs **3× per request** (`generateMetadata`, the page and `RelatedProducts`: `app/products/[id]/page.tsx:12,21,51`), likewise `getPost` twice. `fetch` is memoized per render pass; plain async functions aren't. Wrap them in `React.cache` (per-request dedupe). Note that it's `React.cache`, not `unstable_cache`/`'use cache'`, that fixes *this* problem; those are the **cross-request** layer.
- Cross-request cache: `unstable_cache` / `fetch(..., { next: { revalidate, tags } })` (previous model) or `'use cache'` + `cacheLife` + `cacheTag` (Cache Components).
- Invalidation for price changes:

  ```ts
  'use server'
  import { updateTag, revalidateTag } from 'next/cache'

  export async function updatePrice(id: string, price: number) {
    await db.updatePrice(id, price)
    updateTag(`product:${id}`) // Server Action: the next read sees the new price (read-your-own-writes)
  }
  // From a webhook (Route Handler): revalidateTag(`product:${id}`, 'max') serves stale while regenerating
  ```

- Delete `lib/api.ts` (the self-fetch). It adds an HTTP hop, JSON serialisation, a `headers()` read, and breaks static builds.

### K4. Route handlers and the promo

- `export const dynamic = 'force-dynamic'` on `app/api/products/route.ts:3` and `app/api/promo/route.ts:3` makes GETs that return the same data for everyone uncacheable.
- `/api/products`: remove it, or make it static/ISR (`export const revalidate = 300` in the previous model) or send `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.
- `/api/promo`: render the promo on the server from a cached query (C3). The browser then doesn't pay 800 ms plus a layout shift on every page load.
- `/api/track`: a POST, dynamic, which is correct.

---

## Verification checklist

- [ ] `pnpm build` shows a mix: `○ /about`, `● /blog/[slug]` (with params listed), ISR revalidate times on catalogue routes (or `◐` with Cache Components), and `ƒ /account` only.
- [ ] `curl -sI` on a static page: `s-maxage=…`; ISR page: `s-maxage=N, stale-while-revalidate=…`; `/account`: `private, no-cache, no-store…`; `/_next/static/*.js`: `public, max-age=31536000, immutable`.
- [ ] Repeat requests to ISR pages return `x-nextjs-cache: HIT` (or `STALE` → `REVALIDATED`).
- [ ] The "HTML rendered on the server at …" stamp stays the same between reloads on cacheable pages, and the `[db]` log stays quiet.
- [ ] No hydration errors in dev with `pnpm dev:utc` + Sensors set to `vi-VN` / `Asia/Ho_Chi_Minh`, **and** with JS disabled the page still shows real content.
- [ ] The Network panel shows each image downloaded once, as a small optimised format.
- [ ] Web Vitals HUD / Lighthouse mobile: LCP < 2.5 s, CLS < 0.1, INP < 200 ms (4× CPU), TTFB < 0.8 s.
- [ ] `pnpm lint` is clean (`no-img-element`, `no-sync-scripts`).
- [ ] Setting a name and currency on `/account` still personalizes the site.
