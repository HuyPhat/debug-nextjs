# Requirement analysis

> **"Solid understanding of rendering modes (CSR, SSR, SSG) and hydration, including how to diagnose and fix a hydration mismatch, and their impact on SEO, Core Web Vitals, caching, and personalization."**
> — ekino Vietnam, _Senior / Lead Front-end Developer (React, TypeScript, English)_

Source note: the job page (`ekino.vn`) couldn't be fetched from the environment this project was built in, so this analysis works from the sentence above. Public listings for ekino Vietnam's Senior Front-end role also ask for React, Next.js and TypeScript, and _"hands-on skills in caching, optimizing and securing front-end applications"_. That fits the sentence: they want someone who can make **architecture decisions**, not only write components.

---

## 1. What the sentence is really testing

The sentence covers four different skills:

| # | Skill | What a senior/lead answer sounds like |
|---|-------|---------------------------------------|
| 1 | **Know the modes** (CSR, SSR, SSG, plus ISR, streaming and PPR in modern Next.js) | "I choose **per route, and even per component**, based on how often the data changes and who it's for." |
| 2 | **Understand hydration mechanically** | "The server HTML is a promise. The first client render has to keep it, byte for byte." |
| 3 | **Diagnose and fix a mismatch** (a debugging skill) | A repeatable workflow: reproduce → locate → classify → fix, not "add `suppressHydrationWarning`". |
| 4 | **Reason about trade-offs across 4 axes**: SEO, CWV, caching, personalization | Knows the axes pull against each other. The central tension is **personalization vs caching**. |

"Lead" adds more: setting guardrails for a team (lint rules, CI checks, performance budgets, RUM), reviewing for these problems in PRs, and explaining trade-offs to non-engineers (SEO and marketing people who want "Hi, {name}" on every page).

---

## 2. Rendering modes cheat sheet (Next.js 16 App Router)

| Mode | When is the HTML produced? | How you get it in Next.js 16 | `next build` symbol |
|------|------------------------|------------------------------|---------------------|
| **CSR** | In the browser, after JS loads and fetches data | `'use client'` + `useEffect`/TanStack Query, or `dynamic(() => import(...), { ssr: false })` | n/a (the shell may still be static) |
| **SSR (dynamic)** | On every request | Using a request-time API (`cookies()`, `headers()`, `searchParams`, `connection()`), `fetch(..., { cache: 'no-store' })`, or `export const dynamic = 'force-dynamic'` | `ƒ` |
| **SSG** | At build time | The default when nothing dynamic is used; `generateStaticParams` for dynamic segments | `○` / `●` |
| **ISR** | At build, then regenerated in the background after a TTL or on demand | `export const revalidate = N`, `fetch(..., { next: { revalidate, tags } })`, `unstable_cache`, or `'use cache'` + `cacheLife`/`cacheTag`; `revalidateTag` / `updateTag` / `revalidatePath` | `●` with a _Revalidate_ column |
| **Streaming SSR** | Per request, flushed in chunks | `<Suspense>` boundaries / `loading.tsx` | `ƒ` |
| **PPR** (Cache Components) | Static shell at build time + dynamic "holes" streamed per request | `cacheComponents: true` + `'use cache'` + `<Suspense>` around request-time reads | `◐` |

Two Next.js 16 facts that trip people up:

- In the **previous caching model** (no `cacheComponents`), one `cookies()` call in the **root layout** makes **every route** dynamic. With **Cache Components**, the same read only makes the nearest `<Suspense>` boundary dynamic.
- With Cache Components on, the `dynamic`, `revalidate` and `fetchCache` segment configs are **removed**. You express caching with `'use cache'` instead.

---

## 3. Hydration, precisely

1. The server renders HTML (plus the RSC payload in the App Router). The browser can paint it right away, so **FCP and LCP can happen before any JS runs.**
2. React loads and `hydrateRoot` walks the existing DOM, attaching listeners. It expects the **first client render to produce identical output**.
3. The rule: **the first client render must be a pure function of the same inputs the server had.**

### Causes of mismatches (a checklist for diagnosis)

| Class | Examples |
|-------|----------|
| Non-deterministic values | `Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()` (use `useId` for ids) |
| Environment differences | Time zone, locale (`Intl.*`, `toLocale*String`), server `TZ`/`LANG` vs browser |
| Browser-only state | `typeof window` branches, `localStorage`, `matchMedia`, `window.innerWidth`, `document.cookie` |
| Invalid HTML nesting | `<p><div>`, `<a>` inside `<a>`, `<tr>` without `<tbody>`: the parser "fixes" the DOM, so it no longer matches React's tree |
| Data drift | The server rendered data v1, the client fetched v2 before hydrating (e.g. a TanStack Query client with no dehydrated state), or HTML from a CDN cache paired with newer data |
| Third parties | Browser extensions (Grammarly, translators, password managers), CDN HTML rewriting, A/B scripts that mutate the DOM before hydration |

### What React 19 does when it finds one

| Mismatch | Behaviour | Cost |
|----------|-----------|------|
| **Text or element** | Throws a recoverable error, **discards the server HTML up to the nearest `<Suspense>` boundary** and re-renders on the client. Dev: diff in the overlay. Prod: `Minified React error #418`. | Wasted SSR, an extra render (TBT/INP), flicker, lost focus/scroll, **re-downloaded images** (reproduced in this repo), CLS |
| **Attribute** | Dev warning only: _"This won't be patched up."_ The DOM **keeps the server's attributes**. | Silent in production: wrong `class`, `aria-*`, `href` |
| `suppressHydrationWarning` | Silences one level (the element's own text and attributes) | An escape hatch for values that *must* differ (a timestamp), not a fix |

### Diagnosis workflow (the "how to diagnose" part)

1. **Reproduce.** Run the dev server with `TZ=UTC LANG=en_US.UTF-8` (how most servers run) and set the browser's locale and time zone in **DevTools → Sensors** (e.g. `vi-VN`, `Asia/Ho_Chi_Minh`). Use an incognito window (no extensions). Throttle the CPU to widen timing gaps.
2. **Locate.** Read the diff in the dev overlay (`+ client` / `- server`). In production, decode `#418` and add `onRecoverableError`/error reporting. Bisect by wrapping suspects in `<Suspense>`, which also contains the damage.
3. **Compare.** Put `view-source:` (server HTML) next to the Elements panel (after hydration). Disable JS to see pure SSR output, or `curl` the page.
4. **Classify** the cause with the table above, then **fix** with one of these patterns:
   - **Make it deterministic**: compute on the server once and pass it as a prop; pin `locale` and `timeZone` in `Intl`; use `useId`.
   - **Two-pass render** for client-only values: render a placeholder on the server *and* on the first client render, then fill it in after mount (`useEffect`, or `useSyncExternalStore` with a `getServerSnapshot`). **Reserve the space** so there's no CLS.
   - **Inline blocking script before paint** for theme or local time (Next docs: _Preventing flash before hydration_), plus `suppressHydrationWarning` on the element it mutates.
   - **Fix the HTML** nesting.
   - **Share the server data with the client cache** (TanStack Query `dehydrate` + `HydrationBoundary`, `staleTime > 0`).
   - **Opt out of SSR** for a widget (`ssr: false`) only when it has no SEO value.

---

## 4. Impact matrix

| | SEO | Core Web Vitals | Caching | Personalization |
|---|-----|-----------------|---------|-----------------|
| **CSR** | Weak: empty HTML shell. Depends on Googlebot's JS rendering; other crawlers and social previews see nothing | Fast TTFB, **late LCP** (JS → fetch → render waterfall), CLS risk from skeletons, INP depends on bundle size | Shell is CDN-friendly; data cached over HTTP / TanStack Query | Easy, and no hydration concerns |
| **SSR** | Good: full HTML | **TTFB = slowest query** unless you stream; you pay the hydration cost | Hard: per request, usually `private, no-store` | Easy on the server, but **every cookie read makes the route uncacheable** |
| **SSG** | Best | Best TTFB/LCP (served from a CDN) | Trivial: immutable until the next deploy | None in the HTML; do it on the client or at the edge |
| **ISR** | Best | ≈ SSG | TTL + tags + stale-while-revalidate | Same as SSG. Freshness (prices!) needs on-demand revalidation |
| **PPR / streaming** | Good: the shell has the content, and bots get the full render | Static TTFB; LCP is fast **if the LCP element is in the shell**; skeletons must match final size (CLS); Suspense splits hydration (INP) | Shell cached; holes aren't | Dynamic holes without making the whole page dynamic |

### The central tension: personalization vs caching

Patterns, from most cacheable to least:

1. **Client islands after hydration**: static HTML; fetch "Hi, Huy" / cart count after mount. Costs a request and a possible flash (reserve the space).
2. **Low-cardinality variants in the URL**: currency, locale or A/B bucket become a route segment, and `proxy.ts` rewrites based on a cookie. Each variant is static and CDN-cacheable.
3. **PPR dynamic holes**: static shell plus per-user `<Suspense>` holes (Cache Components).
4. **Fully dynamic SSR**, only for truly per-user pages (account, cart, checkout), cached `private` or not at all.

Anti-patterns: reading `cookies()` in the root layout (previous model), `Vary: Cookie` at the CDN (kills the hit ratio), and `Cache-Control: no-store` on everything "to be safe".

---

## 5. How this repo exercises the requirement

| Requirement keyword | Where it's deliberately broken |
|---------------------|--------------------------------|
| Rendering modes | Every route is dynamic SSR, even `/about` and `/_not-found` (category **R**) |
| Hydration mismatch (diagnose + fix) | Five different root causes across the pages (category **H**) |
| Core Web Vitals | LCP, CLS, INP and TTFB all fail (category **C**) |
| Caching | Nothing is cacheable at any layer: browser, CDN, Next.js data cache, or request memoization (category **K**) |
| SEO | A side effect of R/H/C: slow TTFB, hydration re-renders, and the temptation to "fix" things by going CSR |
| Personalization | The greeting and currency cookies are *why* the whole app became dynamic, so the fix has to keep them working |

---

## 6. Likely interview questions

- "Walk me through everything that happens between the server render and the page becoming interactive."
- "Sentry shows `Minified React error #418` in production only. How do you find it?"
- "Marketing wants `Hi, {name}` on every page and SEO wants everything static. Design it."
- "When would you choose CSR in a Next.js app?"
- "We use ISR for product pages. How do you guarantee a price change shows up within seconds?" (on-demand `revalidateTag`/`updateTag` from the pricing webhook, a short TTL as a safety net, live stock on the client)
- "What happens if middleware sets `Cache-Control: no-store` on every response?" (in this repo it even overrides the immutable header on `/_next/static`)
- "How would you stop this from regressing across a 10-person team?" (ESLint: `@next/next/no-img-element`, `no-sync-scripts`; CI that diffs the `next build` route table; Lighthouse CI / performance budgets; RUM via `useReportWebVitals`)

---

## 7. Mapping to a TanStack stack

- **TanStack Query + SSR:** create a `QueryClient` **per request** on the server (a module-level client leaks data between users) and one per browser session. Prefetch on the server, then `dehydrate` → `<HydrationBoundary>`. Set a default `staleTime > 0` so the client doesn't refetch immediately after hydrating and swap content under the user. The bundled Next docs have a guide: `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md`.
- **TanStack Router / Start:** loaders run on the server for SSR'd routes, and Start supports choosing SSR **per route** (selective SSR). It's the same "choose per route" skill. The hydration rules are React's, so everything in section 3 applies unchanged.
- **Long lists:** `@tanstack/react-virtual` is the natural fix for the 600-card grid in this repo.
