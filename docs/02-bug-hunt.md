# Bug hunt: symptoms only

Everything below is **observable behaviour**. Root causes and fixes are in [`03-solutions.md`](./03-solutions.md), so try to find them yourself first. Each item has a collapsed hint if you get stuck.

Recommended setup:

```bash
npm install
npm run dev:utc        # dev server with TZ=UTC, like a real server
# and, for performance numbers:
npm run build && npm start
```

In Chrome, open **DevTools → Sensors**: set _Location_ to a place in Vietnam (or pick the time zone `Asia/Ho_Chi_Minh`) and _Locale_ to `vi-VN`. Keep the **Network** and **Console** panels open. The black box in the corner is a live Web Vitals readout, and the server terminal prints `[db]` lines for every "database" query.

Baseline measurements from the build this repo was verified with (headless Chromium, production build on localhost), so you can compare after fixing:

| Metric | Value |
|--------|-------|
| TTFB, from `curl` | `/about` 0.32 s · `/blog` 0.63 s · `/` 1.0 s · `/products` 1.2 s · `/products/[id]` 1.9 s |
| Home on slow 4G + 4× CPU | FCP 1.6 s · **LCP ≈ 82 s** (hero image) · **CLS 0.82** |
| Typing "lin" in `/products` search (4× CPU) | slowest interaction **≈ 2,000 ms** |
| "Add to cart" click (no throttling) | ≈ 264 ms |
| `/products` payload | HTML **429 KB**, JS **978 KB** (vs ~586 KB on other pages) |
| DB queries per product-page request | **4** (3 identical) |

---

## R: "We only use one rendering mode"

**R1. `npm run build` prints `ƒ (Dynamic)` for every route**, including `/about` (static text), `/_not-found` and the blog.
<details><summary>Hint</summary>At least <b>three separate things</b> force dynamic rendering, and removing only the obvious one changes nothing. Look at the root layout first, then at how pages load their data.</details>

**R2. Content that's identical for every visitor is regenerated on every request.** Reload `/blog/caring-for-linen` a few times and watch the "HTML rendered on the server at …" stamp and the `[db]` logs.
<details><summary>Hint</summary>Blog posts and the catalogue change rarely. Dynamic segments (<code>[slug]</code>, <code>[id]</code>) never tell Next.js which params exist at build time.</details>

**R3. The personalization (greeting "Hi, …", currency) is why everything became dynamic.** Set a name and currency on `/account`. Whatever you change must keep that working.
<details><summary>Hint</summary>Which file reads the cookies, and how high in the tree is it? What are your options besides "read the cookie on the server for every page"?</details>

**R4. Don't over-correct.** One route *should* stay dynamic, and "just make it all CSR" breaks SEO. Decide the right mode for each route and write down why.

---

## H: Hydration mismatches

Run `npm run dev:utc`. Your browser should be in a different time zone and locale from the server (see Sensors above).

**H1. Home page: "Hydration failed because the server rendered text didn't match the client".** It happens even when your time zone matches the server's.
<details><summary>Hint</summary>Look at the flash-sale line. There are <b>three</b> independent reasons it can differ between server and browser.</details>

**H2. Product page (`/products/p-001`): "In HTML, &lt;div&gt; cannot be a descendant of &lt;p&gt;".**
<details><summary>Hint</summary>Compare <code>view-source:</code> with the Elements panel around the description. The browser's HTML parser changed the DOM before React ever saw it.</details>

**H3. Product page: a number that differs between the server HTML and the hydrated page.**
<details><summary>Hint</summary>"… people are looking at this right now".</details>

**H4. Prices break hydration for some users but not others.** In an `en-US` browser `/products` hydrates cleanly; in `vi-VN` it throws. (Server: `₫2,755,000`; browser: `2.755.000 ₫`.)
<details><summary>Hint</summary>Which locale does <code>Intl.NumberFormat</code> use when you don't pass one, on Node versus in the browser?</details>

**H5. Theme toggle.** Switch to dark, then reload `/about`. The page flashes light first, and the button shows the wrong icon and `aria-label` ("Switch to dark theme" while the page is dark). The production console shows **no error** at all. Interestingly, on `/` the icon is correct. Why?
<details><summary>Hint</summary>React 19 treats <i>attribute</i> mismatches differently from <i>text</i> mismatches. Read the dev warning carefully: "This won't be patched up." Then ask what H1 does to the whole tree on <code>/</code>.</details>

**H6. Compound effect: on first load, the hero image and product images are downloaded twice.** Check the Network panel on `/` with JS enabled vs disabled.
<details><summary>Hint</summary>What does React do with the server DOM after a text mismatch? And what did the server tell the browser about caching those images?</details>

---

## C: Core Web Vitals

Use Lighthouse (mobile) against `npm start`, or the Performance panel with 4× CPU and "Slow 4G".

**C1. LCP: the hero image paints extremely late.** It's the LCP element.
<details><summary>Hint</summary>Check the file size, format, dimensions actually displayed, <code>loading</code> attribute, preload, and <code>fetchpriority</code>. Also check <code>next.config.ts</code>.</details>

**C2. TTFB/FCP: 1–2 s before the first byte, then more blocking before first paint.**
<details><summary>Hint</summary>Server: sequential awaits, duplicate queries, and an HTTP round-trip to your own server. Browser: look at the first <code>&lt;script&gt;</code> in <code>&lt;head&gt;</code> and what it does over the network.</details>

**C3. CLS ≈ 0.8: content jumps down after load.**
<details><summary>Hint</summary>Two sources: something inserted above the content after a client fetch, and images with no reserved space.</details>

**C4. INP: typing in the `/products` search box freezes the page; "Add to cart" feels sticky.**
<details><summary>Hint</summary>Profile one keystroke in the Performance panel. Look at what runs per keystroke, what runs <i>inside a sort comparator</i>, how many cards re-render, and what the click handler waits for synchronously.</details>

**C5. Payload: `/products` ships ~978 KB of JS and a 429 KB HTML document.**
<details><summary>Hint</summary>Run <code>npx next experimental-analyze</code>. Where do <code>moment</code> locales and full <code>lodash</code> come from? How much product data is serialised into the page, and is all of it needed?</details>

`npm run lint` flags some of these for you.

---

## K: No caching anywhere

**K1. Every response says `Cache-Control: no-store`**, including the content-hashed `/_next/static/chunks/*.js` files that are supposed to be `immutable`.
```bash
curl -sI http://localhost:3000/about | grep -i cache-control
curl -sI http://localhost:3000$(curl -s http://localhost:3000/ | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1) | grep -i cache-control
```
<details><summary>Hint</summary>Two files set headers. One runs on <b>every</b> request because it has no <code>matcher</code>.</details>

**K2. Images and the analytics script are re-downloaded on every navigation, and there's no image optimization** (no `/_next/image`, no AVIF/WebP, no resizing).

**K3. Server data: one product-page request runs `products.findUnique` three times**, and pages call their own `/api/*` over HTTP.
<details><summary>Hint</summary><code>generateMetadata</code>, the page and a child component all load the same record. <code>fetch</code> is memoized per request, but a plain function call isn't.</details>

**K4. API routes and the promo banner are never cacheable.** `/api/promo` returns the same campaign to everyone, yet takes 800 ms on every page load.

---

When you're done, `next build` should show a **mix** of `○`, `●` and `ƒ` (or `◐` with Cache Components), the HUD should be green, and each "rendered at" stamp should stay the same between reloads on cacheable pages.
