# Vitalight Foundation + Storefront Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo, add the white/navy/fuchsia brand system, rebuild the storefront in "Layout B", and grow the catalogue to 120 products across 12 categories.

**Architecture:** One `package.json` with a Vite root at `storefront/`, a shared `shared/` folder (pure logic, catalogue data, SVG product art) used by both storefront and server, and the Express API split into `server/app.js` (factory) + `routes/` + `lib/`. Supabase gets a DDL migration plus a seed generated from `shared/catalog.js`, so JS and SQL never drift.

**Tech Stack:** React 19, react-router-dom 7, Vite 7, Express 5, Supabase (`@supabase/supabase-js`), Vitest, Testing Library, Supertest.

Spec: `docs/superpowers/specs/2026-10-13-foundation-storefront-design.md`

## Global Constraints

- Brand colours: white 60%, deep navy `#0b2a50` 30%, French fuchsia `#fd3f92` 10% (pink only on CTAs, discount badges, active states, small highlights).
- Currency is Naira (`₦`), prices are whole-number naira.
- 12 categories, ~10 products each (120 total), exact names listed in Task 4.
- The 7 existing product ids must be kept: `daily-vitamins`, `vitamin-c`, `gentle-cleanser`, `first-aid-kit`, `omega-3`, `digital-thermometer`, `oral-rehydration-salts`.
- Existing admin API behaviour (routes, error messages, status codes) must not change except for the additive optional fields `brand`, `rx_required`, `sort_order`.
- The legacy `/admin` page must keep working until sub-project 2.
- No invented business facts in copy (no made-up delivery thresholds, hours, phone numbers). Contact details come from env via `storefront/src/config.js`.
- No medical claims in product copy beyond neutral pack-size / form descriptors. All catalogue content is sample content the owner must verify.
- Service-role key stays server-only. Never import `server/` code from the browser.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Shell for commands is Git Bash (POSIX), working directory is the repo root.

## Spec refinements made while planning

These deviate slightly from the spec and the spec is updated in Task 11:

1. **No `products.slug` / `categories.slug` columns.** Product `id` is already a unique URL-safe slug; category slugs are derived at runtime with `slugify(name)`. This avoids redundant columns that could drift.
2. `art` is widened from 7 to exactly 14 keys: the existing 7 plus `tube`, `sachet`, `strip`, `dropper`, `spray`, `jar`, `box`.
3. The catalogue SQL seed is generated from `shared/catalog.js` by `scripts/generate-seed.js`.

## File Structure

```
shared/
  assets/logo.png            (moved from "vitalight logo.png")
  artKeys.js                 ART_KEYS, COLOR_KEYS (used by server + UI)
  money.js                   formatPrice
  cart.js                    cartReducer, cartLines, cartTotals, MAX_QUANTITY
  catalogTools.js            slugify, filter/sort/paginate/related, discountPercent
  catalog.js                 12 categories + 120 products (offline fallback + seed source)
  art/ProductArt.jsx         SVG product illustrations
scripts/
  seedSql.js                 buildSeedSql()
  generate-seed.js           writes supabase/migrations/002_seed_catalogue.sql
server/
  index.js                   env + listen
  app.js                     createApp()
  lib/auth.js                parseAdminEmails, createAuth
  lib/validate.js            validateProductInput
  routes/public.js           /api/catalog, /api/orders
  routes/admin.js            /api/admin/*
  test/fakeSupabase.js       test double
supabase/migrations/
  001_catalogue_v2.sql       DDL + category renames
  002_seed_catalogue.sql     generated
storefront/
  index.html
  src/main.jsx, App.jsx, config.js, api.js
  src/context/{CatalogContext,StoreContext}.jsx
  src/components/{Layout,Header,Footer,ProductCard,ProductGrid,ProductRail,CategoryChips,PrescriptionBand,CartDrawer,OrderModal,Toast}.jsx
  src/pages/{HomePage,CategoryPage,ProductPage,SearchPage,SavedPage,NotFoundPage}.jsx
  src/styles/{tokens,base,components,pages}.css
  src/admin/{Admin.jsx,admin.css}      (legacy, moved unchanged)
```

---

### Task 1: Tooling and repo restructure

**Files:**
- Modify: `package.json`, `vite.config.js`, `server/index.js:8,28`, `.env.example`
- Create: `vitest.config.js`
- Move: `index.html`, `src/*`, `vitalight logo.png` (see commands)

**Interfaces:**
- Produces: `npm run build` outputs `dist/storefront/`; `npm test` runs Vitest; `shared/catalog.js` and `shared/assets/logo.png` exist at their final paths.

- [ ] **Step 1: Install dependencies**

```bash
npm install react-router-dom
npm install -D vitest jsdom @testing-library/react @testing-library/user-event supertest
```
Expected: installs without peer-dependency errors.

- [ ] **Step 2: Move files**

```bash
mkdir -p storefront/src/admin shared/assets
git mv index.html storefront/index.html
git mv src/main.jsx storefront/src/main.jsx
git mv src/App.jsx storefront/src/App.jsx
git mv src/styles.css storefront/src/styles.css
git mv src/Admin.jsx storefront/src/admin/Admin.jsx
git mv src/admin.css storefront/src/admin/admin.css
git mv src/catalog.js shared/catalog.js
git mv "vitalight logo.png" shared/assets/logo.png
```

- [ ] **Step 3: Fix imports**

In `storefront/src/App.jsx` replace the first three import lines' paths:
```jsx
import logo from '../../shared/assets/logo.png'
import { categories as starterCategories, products as starterProducts } from '../../shared/catalog.js'
```
In `storefront/src/admin/Admin.jsx` replace `import logo from '../vitalight logo.png'` with:
```jsx
import logo from '../../../shared/assets/logo.png'
```
Replace `storefront/src/main.jsx` entirely (admin is lazy-loaded so the storefront bundle excludes supabase-js):
```jsx
import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const Admin = lazy(() => import('./admin/Admin.jsx'))
const isAdmin = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Suspense fallback={null}><Admin /></Suspense> : <App />}
  </React.StrictMode>,
)
```
In `server/index.js` change line 8 to `import { categories as starterCategories, products as starterProducts } from '../shared/catalog.js'` and line 28 to `const clientDistPath = path.resolve(__dirname, '..', 'dist', 'storefront')`.

- [ ] **Step 4: Replace `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: 'storefront',
  envDir: projectRoot,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./dist/storefront', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
})
```

- [ ] **Step 5: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['{shared,server,storefront,scripts}/**/*.test.{js,jsx}'],
  },
})
```

- [ ] **Step 6: Update `package.json` scripts**

Add `"test": "vitest run"` to `scripts` (keep `dev`, `build`, `start`, `preview`).

- [ ] **Step 7: Append to `.env.example`**

```
# Storefront contact details (optional; buttons are hidden when blank)
VITE_PHARMACY_PHONE=
VITE_PHARMACY_WHATSAPP=
VITE_PHARMACY_EMAIL=hello@vitalightpharmacy.com
```

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds; `dist/storefront/index.html` exists. The old `dist/index.html` is stale and ignored.

- [ ] **Step 9: Verify API still boots**

Run: `node --check server/index.js`
Expected: no output (syntax OK).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: restructure repo into storefront/ and shared/, add Vitest"
```

---

### Task 2: Shared pure logic (TDD)

**Files:**
- Create: `shared/artKeys.js`, `shared/money.js`, `shared/cart.js`, `shared/catalogTools.js`
- Test: `shared/money.test.js`, `shared/cart.test.js`, `shared/catalogTools.test.js`

**Interfaces:**
- Produces:
  - `ART_KEYS: string[]` (14), `COLOR_KEYS: string[]` (4)
  - `formatPrice(amount: number): string`
  - `MAX_QUANTITY = 99`; `cartReducer(state: Record<string, number>, action)` with actions `{type:'add', id, quantity?}`, `{type:'set', id, quantity}`, `{type:'remove', id}`, `{type:'clear'}`; `cartLines(cart, products): {product, quantity, lineTotal}[]`; `cartTotals(lines): {count, total, hasRx}`
  - `slugify(text)`, `categorySlug(name)`, `findCategoryBySlug(categories, slug)`, `isInStock(p)`, `discountPercent(p)`, `brandsOf(products)`, `filterProducts(products, filters)`, `sortProducts(products, sort)`, `paginate(items, page, perPage)`, `relatedProducts(products, product, limit)`
  - Product shape used everywhere: `{ id, name, category, brand, detail, price, oldPrice, tag, art, color, image_url, stock, featured, rx_required, sort_order }`

- [ ] **Step 1: Write failing tests**

`shared/money.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { formatPrice } from './money.js'

describe('formatPrice', () => {
  it('formats whole naira with grouping', () => {
    expect(formatPrice(8500)).toBe('₦8,500')
    expect(formatPrice(1234567)).toBe('₦1,234,567')
    expect(formatPrice(0)).toBe('₦0')
  })
  it('treats invalid input as zero', () => {
    expect(formatPrice(undefined)).toBe('₦0')
    expect(formatPrice(NaN)).toBe('₦0')
  })
})
```

`shared/cart.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { cartReducer, cartLines, cartTotals, MAX_QUANTITY } from './cart.js'

const products = [
  { id: 'a', name: 'A', price: 1000, rx_required: false },
  { id: 'b', name: 'B', price: 2500, rx_required: true },
]

describe('cartReducer', () => {
  it('adds and accumulates quantities', () => {
    let state = cartReducer({}, { type: 'add', id: 'a' })
    state = cartReducer(state, { type: 'add', id: 'a', quantity: 2 })
    expect(state).toEqual({ a: 3 })
  })
  it('caps quantity at MAX_QUANTITY', () => {
    const state = cartReducer({ a: 98 }, { type: 'add', id: 'a', quantity: 10 })
    expect(state.a).toBe(MAX_QUANTITY)
  })
  it('set below 1 or NaN removes the line', () => {
    expect(cartReducer({ a: 2 }, { type: 'set', id: 'a', quantity: 0 })).toEqual({})
    expect(cartReducer({ a: 2 }, { type: 'set', id: 'a', quantity: NaN })).toEqual({})
  })
  it('set updates quantity; remove and clear work', () => {
    expect(cartReducer({ a: 2 }, { type: 'set', id: 'a', quantity: 5 })).toEqual({ a: 5 })
    expect(cartReducer({ a: 2, b: 1 }, { type: 'remove', id: 'a' })).toEqual({ b: 1 })
    expect(cartReducer({ a: 2 }, { type: 'clear' })).toEqual({})
  })
})

describe('cartLines / cartTotals', () => {
  it('ignores unknown ids and totals correctly', () => {
    const lines = cartLines({ a: 2, b: 1, ghost: 4 }, products)
    expect(lines).toHaveLength(2)
    expect(cartTotals(lines)).toEqual({ count: 3, total: 4500, hasRx: true })
  })
  it('hasRx is false without prescription items', () => {
    const lines = cartLines({ a: 1 }, products)
    expect(cartTotals(lines).hasRx).toBe(false)
  })
})
```

`shared/catalogTools.test.js`:
```js
import { describe, expect, it } from 'vitest'
import {
  slugify, categorySlug, findCategoryBySlug, isInStock, discountPercent,
  brandsOf, filterProducts, sortProducts, paginate, relatedProducts,
} from './catalogTools.js'

const products = [
  { id: 'p1', name: 'Paracetamol', brand: 'Vitalight', category: 'Medicines & pain relief', detail: '24 tablets', price: 1200, oldPrice: null, stock: 10, featured: true, sort_order: 1 },
  { id: 'p2', name: 'Ibuprofen', brand: 'Vitalight', category: 'Medicines & pain relief', detail: '20 tablets', price: 1800, oldPrice: 2400, stock: 0, featured: false, sort_order: 0 },
  { id: 'p3', name: 'Sunscreen', brand: 'DermaCalm', category: 'Skin care & dermatology', detail: '75 ml', price: 9500, oldPrice: null, stock: 4, featured: false, sort_order: 0 },
]

describe('slugs', () => {
  it('slugifies ampersands and punctuation', () => {
    expect(slugify('Vitamins & supplements')).toBe('vitamins-and-supplements')
    expect(slugify('Cold, flu & allergy')).toBe('cold-flu-and-allergy')
    expect(categorySlug('Mother & baby')).toBe('mother-and-baby')
  })
  it('finds categories by slug', () => {
    const categories = [{ name: 'Mother & baby' }, { name: 'First aid & wound care' }]
    expect(findCategoryBySlug(categories, 'first-aid-and-wound-care').name).toBe('First aid & wound care')
    expect(findCategoryBySlug(categories, 'nope')).toBeNull()
  })
})

describe('product helpers', () => {
  it('isInStock and discountPercent', () => {
    expect(isInStock(products[0])).toBe(true)
    expect(isInStock(products[1])).toBe(false)
    expect(discountPercent(products[1])).toBe(25)
    expect(discountPercent(products[0])).toBe(0)
  })
  it('brandsOf returns unique sorted brands', () => {
    expect(brandsOf(products)).toEqual(['DermaCalm', 'Vitalight'])
  })
})

describe('filterProducts', () => {
  it('filters by category, query, stock, sale, price and brand', () => {
    expect(filterProducts(products, { category: 'Skin care & dermatology' }).map((p) => p.id)).toEqual(['p3'])
    expect(filterProducts(products, { query: 'ibu' }).map((p) => p.id)).toEqual(['p2'])
    expect(filterProducts(products, { inStockOnly: true }).map((p) => p.id)).toEqual(['p1', 'p3'])
    expect(filterProducts(products, { onSaleOnly: true }).map((p) => p.id)).toEqual(['p2'])
    expect(filterProducts(products, { minPrice: 1500, maxPrice: 5000 }).map((p) => p.id)).toEqual(['p2'])
    expect(filterProducts(products, { brands: ['DermaCalm'] }).map((p) => p.id)).toEqual(['p3'])
  })
  it('matches brand and detail text in query', () => {
    expect(filterProducts(products, { query: 'dermacalm' })).toHaveLength(1)
    expect(filterProducts(products, { query: '75 ml' })).toHaveLength(1)
  })
})

describe('sortProducts', () => {
  it('sorts by price, name, discount and featured', () => {
    expect(sortProducts(products, 'price-asc').map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(sortProducts(products, 'price-desc').map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])
    expect(sortProducts(products, 'name').map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
    expect(sortProducts(products, 'discount')[0].id).toBe('p2')
    expect(sortProducts(products, 'featured')[0].id).toBe('p1')
  })
  it('does not mutate the input', () => {
    const copy = [...products]
    sortProducts(products, 'price-desc')
    expect(products).toEqual(copy)
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i)
  it('slices pages and clamps out-of-range pages', () => {
    expect(paginate(items, 1, 12)).toMatchObject({ page: 1, pages: 3, total: 25 })
    expect(paginate(items, 3, 12).items).toHaveLength(1)
    expect(paginate(items, 99, 12).page).toBe(3)
    expect(paginate(items, 0, 12).page).toBe(1)
    expect(paginate([], 1, 12)).toMatchObject({ page: 1, pages: 1, total: 0, items: [] })
  })
})

describe('relatedProducts', () => {
  it('returns same-category products excluding the product itself', () => {
    expect(relatedProducts(products, products[0]).map((p) => p.id)).toEqual(['p2'])
  })
  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `X${i}`, category: 'C', price: 1, stock: 1 }))
    expect(relatedProducts(many, many[0], 4)).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`shared/artKeys.js`:
```js
export const ART_KEYS = [
  'vitamin', 'vitaminc', 'cleanser', 'firstaid', 'omega', 'device', 'medicine',
  'tube', 'sachet', 'strip', 'dropper', 'spray', 'jar', 'box',
]
export const COLOR_KEYS = ['lavender', 'peach', 'mint', 'blue']
```

`shared/money.js`:
```js
export function formatPrice(amount) {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0
  return `₦${value.toLocaleString('en-NG')}`
}
```

`shared/cart.js`:
```js
export const MAX_QUANTITY = 99

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const next = Math.min(MAX_QUANTITY, (state[action.id] || 0) + (action.quantity ?? 1))
      return { ...state, [action.id]: next }
    }
    case 'set': {
      const quantity = Math.min(MAX_QUANTITY, Math.floor(action.quantity))
      if (!(quantity >= 1)) {
        const { [action.id]: _removed, ...rest } = state
        return rest
      }
      return { ...state, [action.id]: quantity }
    }
    case 'remove': {
      const { [action.id]: _removed, ...rest } = state
      return rest
    }
    case 'clear':
      return {}
    default:
      return state
  }
}

export function cartLines(cart, products) {
  return products
    .filter((product) => cart[product.id] > 0)
    .map((product) => ({
      product,
      quantity: cart[product.id],
      lineTotal: product.price * cart[product.id],
    }))
}

export function cartTotals(lines) {
  return {
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    hasRx: lines.some((line) => Boolean(line.product.rx_required)),
  }
}
```

`shared/catalogTools.js`:
```js
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const categorySlug = slugify

export function findCategoryBySlug(categories, slug) {
  return categories.find((category) => slugify(category.name) === slug) ?? null
}

export function isInStock(product) {
  return Number(product.stock) > 0
}

export function discountPercent(product) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0
  return Math.round((1 - product.price / product.oldPrice) * 100)
}

export function brandsOf(products) {
  return [...new Set(products.map((product) => product.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
}

export function filterProducts(products, filters = {}) {
  const query = (filters.query || '').trim().toLowerCase()
  return products.filter((product) => {
    if (filters.category && product.category !== filters.category) return false
    if (query && !`${product.name} ${product.brand || ''} ${product.category} ${product.detail || ''}`.toLowerCase().includes(query)) return false
    if (filters.inStockOnly && !isInStock(product)) return false
    if (filters.onSaleOnly && discountPercent(product) === 0) return false
    if (Number.isFinite(filters.minPrice) && product.price < filters.minPrice) return false
    if (Number.isFinite(filters.maxPrice) && product.price > filters.maxPrice) return false
    if (filters.brands?.length && !filters.brands.includes(product.brand)) return false
    return true
  })
}

export function sortProducts(products, sort = 'featured') {
  const list = [...products]
  const byName = (a, b) => a.name.localeCompare(b.name)
  switch (sort) {
    case 'price-asc': return list.sort((a, b) => a.price - b.price || byName(a, b))
    case 'price-desc': return list.sort((a, b) => b.price - a.price || byName(a, b))
    case 'name': return list.sort(byName)
    case 'discount': return list.sort((a, b) => discountPercent(b) - discountPercent(a) || byName(a, b))
    default:
      return list.sort((a, b) =>
        Number(Boolean(b.featured)) - Number(Boolean(a.featured))
        || (a.sort_order ?? 0) - (b.sort_order ?? 0)
        || byName(a, b))
  }
}

export function paginate(items, page = 1, perPage = 12) {
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  return {
    items: items.slice((current - 1) * perPage, current * perPage),
    page: current,
    pages,
    total: items.length,
  }
}

export function relatedProducts(products, product, limit = 4) {
  return sortProducts(
    products.filter((candidate) => candidate.id !== product.id && candidate.category === product.category),
    'featured',
  ).slice(0, limit)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add shared
git commit -m "feat: add shared money, cart and catalogue logic with tests"
```

---

### Task 3: Server modularisation with route tests

**Files:**
- Create: `server/lib/auth.js`, `server/lib/validate.js`, `server/routes/public.js`, `server/routes/admin.js`, `server/app.js`, `server/test/fakeSupabase.js`
- Modify: `server/index.js` (replace entirely)
- Test: `server/test/validate.test.js`, `server/test/app.test.js`

**Interfaces:**
- Consumes: `ART_KEYS`, `COLOR_KEYS` from `shared/artKeys.js`; `categories`, `products` from `shared/catalog.js`.
- Produces:
  - `createApp({ supabase, supabaseUrl, admins, starter: {products, categories}, clientDistPath }) => express.Express`
  - `parseAdminEmails(value: string): Set<string>`
  - `createAuth({ supabase, admins }) => { requireDatabase, requireAdmin }`
  - `validateProductInput(body, { supabaseUrl, requireId }) => { error: string } | { value: object }`; `value` always has `name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured`; has `id` when `requireId`; has `brand`, `rx_required`, `sort_order` **only if present in body**.
  - Public catalog product shape: DB columns plus `oldPrice` (camelCase alias of `old_price`).

- [ ] **Step 1: Write the fake Supabase test double**

`server/test/fakeSupabase.js`:
```js
// Minimal chainable stand-in for the Supabase client.
// results: { [table]: { data, error } } returned when a chain is awaited or ends in single()/maybeSingle().
export function fakeSupabase({ user = null, results = {} } = {}) {
  const calls = []

  function from(table) {
    const state = { table, ops: [] }
    calls.push(state)
    const result = () => results[table] ?? { data: [], error: null }
    const chain = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
        return (...args) => {
          state.ops.push([prop, args])
          if (prop === 'single' || prop === 'maybeSingle') {
            const value = result()
            return Promise.resolve(Array.isArray(value.data) ? { ...value, data: value.data[0] ?? null } : value)
          }
          return chain
        }
      },
    })
    return chain
  }

  return {
    calls,
    from,
    auth: {
      async getUser(token) {
        if (user && token === 'good-token') return { data: { user }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (objectPath) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/product-images/${objectPath}` } }),
      }),
    },
  }
}
```

- [ ] **Step 2: Write failing tests**

`server/test/validate.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { validateProductInput } from '../lib/validate.js'

const base = {
  name: 'Paracetamol 500 mg', category: 'Medicines & pain relief', detail: '24 tablets',
  price: 1200, old_price: null, tag: 'NEW', art: 'strip', color: 'mint',
  stock: 10, is_active: true, featured: false,
}

describe('validateProductInput', () => {
  it('accepts a valid product and trims strings', () => {
    const result = validateProductInput({ ...base, name: '  Paracetamol 500 mg ' })
    expect(result.error).toBeUndefined()
    expect(result.value.name).toBe('Paracetamol 500 mg')
    expect(result.value.old_price).toBeNull()
  })
  it('only includes optional fields that were provided', () => {
    const without = validateProductInput(base).value
    expect('brand' in without).toBe(false)
    expect('rx_required' in without).toBe(false)
    expect('sort_order' in without).toBe(false)
    const withAll = validateProductInput({ ...base, brand: ' Vitalight ', rx_required: true, sort_order: 3 }).value
    expect(withAll).toMatchObject({ brand: 'Vitalight', rx_required: true, sort_order: 3 })
  })
  it('accepts the new art keys and rejects unknown ones', () => {
    expect(validateProductInput({ ...base, art: 'tube' }).error).toBeUndefined()
    expect(validateProductInput({ ...base, art: 'unicorn' }).error).toMatch(/illustration/)
  })
  it('requires a valid id when requireId is set', () => {
    expect(validateProductInput(base, { requireId: true }).error).toMatch(/product ID/)
    expect(validateProductInput({ ...base, id: 'Bad Id' }, { requireId: true }).error).toMatch(/product ID/)
    expect(validateProductInput({ ...base, id: 'good-id' }, { requireId: true }).value.id).toBe('good-id')
  })
  it('rejects bad prices, stock and optional fields', () => {
    expect(validateProductInput({ ...base, price: 12.5 }).error).toMatch(/price/)
    expect(validateProductInput({ ...base, stock: -1 }).error).toMatch(/Stock/)
    expect(validateProductInput({ ...base, rx_required: 'yes' }).error).toMatch(/prescription/)
    expect(validateProductInput({ ...base, sort_order: 1000 }).error).toMatch(/order/)
    expect(validateProductInput({ ...base, brand: 'x'.repeat(61) }).error).toMatch(/Brand/)
  })
  it('only accepts images from the product-images bucket', () => {
    const supabaseUrl = 'https://example.supabase.co'
    const ok = `${supabaseUrl}/storage/v1/object/public/product-images/a/b.png`
    expect(validateProductInput({ ...base, image_url: ok }, { supabaseUrl }).error).toBeUndefined()
    expect(validateProductInput({ ...base, image_url: 'https://evil.test/x.png' }, { supabaseUrl }).error).toMatch(/image library/)
  })
})
```

`server/test/app.test.js`:
```js
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { parseAdminEmails } from '../lib/auth.js'
import { fakeSupabase } from './fakeSupabase.js'

const starter = {
  products: [{ id: 'demo', name: 'Demo', category: 'Medicines & pain relief', price: 100 }],
  categories: [{ name: 'Medicines & pain relief', icon: '✚', description: 'x' }],
}
const adminUser = { id: 'u1', email: 'owner@example.com', email_confirmed_at: '2026-01-01' }
const supabaseUrl = 'https://example.supabase.co'

function appWith(supabase, admins = 'owner@example.com') {
  return createApp({
    supabase,
    supabaseUrl,
    admins: parseAdminEmails(admins),
    starter,
    clientDistPath: 'dist/storefront',
  })
}

describe('health and catalog', () => {
  it('reports configuration flags', async () => {
    const res = await request(appWith(null, '')).get('/api/health')
    expect(res.body).toEqual({ status: 'ok', supabaseConfigured: false, adminConfigured: false })
  })
  it('serves the starter catalogue without Supabase', async () => {
    const res = await request(appWith(null)).get('/api/catalog')
    expect(res.status).toBe(200)
    expect(res.body.products[0].id).toBe('demo')
  })
  it('maps old_price to oldPrice for live products', async () => {
    const supabase = fakeSupabase({ results: {
      products: { data: [{ id: 'a', name: 'A', price: 100, old_price: 150 }], error: null },
      categories: { data: [{ name: 'C' }], error: null },
    } })
    const res = await request(appWith(supabase)).get('/api/catalog')
    expect(res.body.products[0]).toMatchObject({ id: 'a', old_price: 150, oldPrice: 150 })
  })
})

describe('POST /api/orders validation', () => {
  const valid = { name: 'Ada Okafor', phone: '+234 800 000 0000', address: '12 Example Street', items: [{ productId: 'demo', quantity: 1 }] }
  it('rejects bad input', async () => {
    const app = appWith(null)
    expect((await request(app).post('/api/orders').send({ ...valid, name: 'A' })).status).toBe(400)
    expect((await request(app).post('/api/orders').send({ ...valid, phone: 'abc' })).status).toBe(400)
    expect((await request(app).post('/api/orders').send({ ...valid, items: [] })).status).toBe(400)
    expect((await request(app).post('/api/orders').send({ ...valid, items: [{ productId: 'Bad ID', quantity: 1 }] })).status).toBe(400)
  })
  it('returns 503 for a valid order when Supabase is not configured', async () => {
    expect((await request(appWith(null)).post('/api/orders').send(valid)).status).toBe(503)
  })
  it('rejects orders exceeding stock', async () => {
    const supabase = fakeSupabase({ results: { products: { data: [{ id: 'demo', stock: 0 }], error: null } } })
    const res = await request(appWith(supabase)).post('/api/orders').send(valid)
    expect(res.status).toBe(409)
  })
})

describe('admin authentication', () => {
  const supabase = () => fakeSupabase({ user: adminUser })
  it('401 without a token, 401 with a bad token', async () => {
    const app = appWith(supabase())
    expect((await request(app).get('/api/admin/me')).status).toBe(401)
    expect((await request(app).get('/api/admin/me').set('Authorization', 'Bearer nope')).status).toBe(401)
  })
  it('403 for a valid user who is not an admin', async () => {
    const app = appWith(supabase(), 'someone-else@example.com')
    const res = await request(app).get('/api/admin/me').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(403)
  })
  it('200 for an approved admin', async () => {
    const res = await request(appWith(supabase())).get('/api/admin/me').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('owner@example.com')
  })
  it('503 when no admins are configured', async () => {
    const res = await request(appWith(supabase(), '')).get('/api/admin/me').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(503)
  })
})

describe('admin products', () => {
  const body = {
    id: 'new-item', name: 'New Item', category: 'Medicines & pain relief', detail: '', price: 500,
    old_price: null, tag: '', art: 'tube', color: 'mint', image_url: null, stock: 5,
    is_active: true, featured: false, brand: 'Vitalight', rx_required: true,
  }
  it('creates a product with the new fields', async () => {
    const supabase = fakeSupabase({ user: adminUser, results: { products: { data: [{ ...body }], error: null } } })
    const res = await request(appWith(supabase)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send(body)
    expect(res.status).toBe(201)
    const insert = supabase.calls.flatMap((c) => c.ops).find(([name]) => name === 'insert')
    expect(insert[1][0]).toMatchObject({ id: 'new-item', brand: 'Vitalight', rx_required: true })
  })
  it('PUT does not overwrite optional fields that were not sent', async () => {
    const { id: _id, brand: _b, rx_required: _r, ...legacy } = body
    const supabase = fakeSupabase({ user: adminUser, results: { products: { data: [{ id: 'new-item' }], error: null } } })
    const res = await request(appWith(supabase)).put('/api/admin/products/new-item').set('Authorization', 'Bearer good-token').send(legacy)
    expect(res.status).toBe(200)
    const update = supabase.calls.flatMap((c) => c.ops).find(([name]) => name === 'update')
    expect('rx_required' in update[1][0]).toBe(false)
    expect('brand' in update[1][0]).toBe(false)
  })
  it('rejects an unknown art key', async () => {
    const supabase = fakeSupabase({ user: adminUser })
    const res = await request(appWith(supabase)).post('/api/admin/products').set('Authorization', 'Bearer good-token').send({ ...body, art: 'unicorn' })
    expect(res.status).toBe(400)
  })
  it('unknown admin routes return 404 for admins', async () => {
    const res = await request(appWith(fakeSupabase({ user: adminUser }))).get('/api/admin/nothing').set('Authorization', 'Bearer good-token')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement `server/lib/auth.js`**

```js
export function parseAdminEmails(value = '') {
  return new Set(
    value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
}

export function createAuth({ supabase, admins }) {
  const notConfigured = {
    error: 'The admin API is not configured. Add Supabase server credentials to the server environment.',
  }

  function requireDatabase(_req, res, next) {
    if (!supabase) return res.status(503).json(notConfigured)
    return next()
  }

  async function requireAdmin(req, res, next) {
    if (!supabase) return res.status(503).json(notConfigured)
    if (admins.size === 0) {
      return res.status(503).json({ error: 'Admin access is not configured. Add an approved email to ADMIN_EMAILS.' })
    }

    const authorization = req.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!token) {
      return res.status(401).json({ error: 'Sign in with an approved admin account to continue.' })
    }

    try {
      const { data, error } = await supabase.auth.getUser(token)
      const user = data?.user
      if (error || !user || !user.email) {
        return res.status(401).json({ error: 'Your admin session is invalid or expired. Sign in again.' })
      }
      if (!user.email_confirmed_at || !admins.has(user.email.toLowerCase())) {
        return res.status(403).json({ error: 'This account is not authorised to manage the pharmacy.' })
      }
      req.admin = { id: user.id, email: user.email }
      return next()
    } catch (error) {
      console.error('Unable to verify admin session:', error.message)
      return res.status(503).json({ error: 'Admin sign-in could not be verified. Please try again shortly.' })
    }
  }

  return { requireDatabase, requireAdmin }
}
```

- [ ] **Step 5: Implement `server/lib/validate.js`**

```js
import { ART_KEYS, COLOR_KEYS } from '../../shared/artKeys.js'

const allowedArt = new Set(ART_KEYS)
const allowedColors = new Set(COLOR_KEYS)
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const fail = (error) => ({ error })

export function validateProductInput(body = {}, { supabaseUrl = '', requireId = false } = {}) {
  const { id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured } = body

  if (requireId && (typeof id !== 'string' || !ID_PATTERN.test(id) || id.length > 60)) {
    return fail('Use a unique product ID made from lowercase letters, numbers, and hyphens.')
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) {
    return fail('Product names must contain 2 to 120 characters.')
  }
  if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 80) {
    return fail('Choose a valid product category.')
  }
  if (typeof detail !== 'string' || detail.trim().length > 240 || !Number.isInteger(price) || price < 0 || price > 100000000) {
    return fail('Enter a description up to 240 characters and a valid whole-number price.')
  }
  if (old_price !== null && old_price !== undefined && (!Number.isInteger(old_price) || old_price < 0 || old_price > 100000000)) {
    return fail('The original price must be a valid whole number or left empty.')
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    return fail('Stock must be a whole number between 0 and 1,000,000.')
  }
  if (typeof tag !== 'string' || tag.trim().length > 30 || !allowedArt.has(art) || !allowedColors.has(color)) {
    return fail('Choose a valid product badge, illustration, and background colour.')
  }
  if (typeof is_active !== 'boolean' || typeof featured !== 'boolean') {
    return fail('Choose whether this product is active and featured.')
  }
  if (image_url !== null && image_url !== undefined
    && (typeof image_url !== 'string' || !image_url.startsWith(`${supabaseUrl}/storage/v1/object/public/product-images/`))) {
    return fail('Product images must be uploaded to the pharmacy image library.')
  }

  const value = {
    name: name.trim(),
    category: category.trim(),
    detail: detail.trim(),
    price,
    old_price: old_price ?? null,
    tag: tag.trim(),
    art,
    color,
    image_url: image_url || null,
    stock,
    is_active,
    featured,
  }
  if (requireId) value.id = id

  // Optional fields: only validated and included when sent, so older clients
  // editing a product never reset them to defaults.
  if (body.brand !== undefined) {
    if (typeof body.brand !== 'string' || body.brand.trim().length > 60) return fail('Brand names can contain up to 60 characters.')
    value.brand = body.brand.trim()
  }
  if (body.rx_required !== undefined) {
    if (typeof body.rx_required !== 'boolean') return fail('Choose whether this product requires a prescription.')
    value.rx_required = body.rx_required
  }
  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order) || body.sort_order < 0 || body.sort_order > 999) {
      return fail('Display order must be a whole number between 0 and 999.')
    }
    value.sort_order = body.sort_order
  }
  return { value }
}
```

- [ ] **Step 6: Implement `server/routes/public.js`**

```js
import { Router } from 'express'

const CATALOG_PRODUCT_COLUMNS = 'id, name, category, detail, price, old_price, tag, art, color, image_url, stock, is_active, featured, brand, rx_required, sort_order'

export function publicRoutes({ supabase, starter }) {
  const router = Router()

  router.get('/catalog', async (_req, res) => {
    if (!supabase) return res.json({ products: starter.products, categories: starter.categories })
    try {
      const [{ data: products, error: productsError }, { data: categories, error: categoriesError }] = await Promise.all([
        supabase.from('products')
          .select(CATALOG_PRODUCT_COLUMNS)
          .eq('is_active', true)
          .order('featured', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase.from('categories')
          .select('name, description, icon, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ])
      if (productsError) throw productsError
      if (categoriesError) throw categoriesError
      return res.json({
        products: products.map((product) => ({ ...product, oldPrice: product.old_price })),
        categories,
      })
    } catch (error) {
      console.error('Unable to load the live storefront catalogue:', error.message)
      return res.status(503).json({ error: 'The live catalogue could not be loaded. Please try again shortly.' })
    }
  })

  router.post('/orders', async (req, res) => {
    const { name, phone, address, items } = req.body ?? {}
    const customerName = typeof name === 'string' ? name.trim() : ''
    const customerPhone = typeof phone === 'string' ? phone.trim() : ''
    const deliveryAddress = typeof address === 'string' ? address.trim() : ''

    if (customerName.length < 2 || customerName.length > 100) {
      return res.status(400).json({ error: 'Enter a name between 2 and 100 characters.' })
    }
    if (!/^[+\d\s()-]{7,25}$/.test(customerPhone)) {
      return res.status(400).json({ error: 'Enter a valid phone number.' })
    }
    if (deliveryAddress.length < 5 || deliveryAddress.length > 500) {
      return res.status(400).json({ error: 'Enter a delivery address between 5 and 500 characters.' })
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
      return res.status(400).json({ error: 'Your order must contain between 1 and 20 products.' })
    }
    for (const item of items) {
      if (
        !item
        || typeof item.productId !== 'string'
        || !/^[a-z0-9-]{1,60}$/.test(item.productId)
        || !Number.isInteger(item.quantity)
        || item.quantity < 1
        || item.quantity > 99
      ) {
        return res.status(400).json({ error: 'One or more products in your order are invalid.' })
      }
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Order requests are not available yet. Please contact the pharmacy directly.' })
    }

    try {
      const { data: activeProducts, error: productError } = await supabase
        .from('products')
        .select('id, name, price, stock')
        .in('id', items.map((item) => item.productId))
        .eq('is_active', true)
      if (productError) throw productError
      const available = new Map(activeProducts.map((product) => [product.id, product]))
      if (items.some((item) => !available.has(item.productId))) {
        return res.status(400).json({ error: 'One or more products are no longer available. Refresh the catalogue and try again.' })
      }
      if (items.some((item) => available.get(item.productId).stock < item.quantity)) {
        return res.status(409).json({ error: 'One or more products do not have enough stock. Refresh the catalogue and try again.' })
      }

      const orderItems = items.map((item) => {
        const product = available.get(item.productId)
        return { productId: item.productId, name: product.name, price: product.price, quantity: item.quantity }
      })
      const { data, error } = await supabase
        .from('orders')
        .insert({
          customer_name: customerName,
          phone: customerPhone,
          delivery_address: deliveryAddress,
          items: orderItems,
          status: 'new',
        })
        .select('id')
        .single()
      if (error) throw error
      return res.status(201).json({ orderId: data.id, message: 'Your order request was received.' })
    } catch (error) {
      console.error('Unable to save pharmacy order:', error.message)
      return res.status(500).json({ error: 'We could not submit your request. Please try again shortly.' })
    }
  })

  return router
}
```

Note: the original order handler selected only `id, stock` and then used `product.name`/`product.price` from the same row (a latent bug: both were `undefined`). Selecting `id, name, price, stock` fixes that.

- [ ] **Step 7: Implement `server/routes/admin.js`**

```js
import express, { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { validateProductInput } from '../lib/validate.js'

const allowedStatuses = new Set(['new', 'contacted', 'fulfilled', 'cancelled'])

const imageTypes = {
  'image/jpeg': { extension: 'jpg', signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: 'webp', signature: (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
}

function validateCategoryInput(body = {}) {
  const { name, description, icon, sort_order, is_active } = body
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return { error: 'Category names must contain 2 to 80 characters.' }
  }
  if (typeof description !== 'string' || description.trim().length > 160 || typeof icon !== 'string' || icon.length > 8) {
    return { error: 'Enter a description up to 160 characters and a short category icon.' }
  }
  if (!Number.isInteger(sort_order) || sort_order < 0 || sort_order > 999 || typeof is_active !== 'boolean') {
    return { error: 'Enter a valid display order and choose whether the category is active.' }
  }
  return { value: { name: name.trim(), description: description.trim(), icon, sort_order, is_active } }
}

export function adminRoutes({ supabase, supabaseUrl, auth }) {
  const router = Router()
  router.use(auth.requireAdmin)

  router.get('/me', (req, res) => res.json({ user: req.admin }))

  router.get('/overview', async (_req, res) => {
    try {
      const [{ data: products, error: productsError }, { data: orders, error: ordersError }, { data: categories, error: categoriesError }] = await Promise.all([
        supabase.from('products').select('id, is_active, stock'),
        supabase.from('orders').select('id, status, created_at'),
        supabase.from('categories').select('name'),
      ])
      if (productsError) throw productsError
      if (ordersError) throw ordersError
      if (categoriesError) throw categoriesError
      return res.json({
        products: products.length,
        activeProducts: products.filter((product) => product.is_active).length,
        lowStock: products.filter((product) => product.is_active && product.stock <= 5).length,
        orders: orders.length,
        newOrders: orders.filter((order) => order.status === 'new').length,
        categories: categories.length,
        recentOrders: orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
      })
    } catch (error) {
      console.error('Unable to load pharmacy admin overview:', error.message)
      return res.status(500).json({ error: 'The dashboard summary could not be loaded.' })
    }
  })

  router.get('/products', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ products: data })
    } catch (error) {
      console.error('Unable to list pharmacy products:', error.message)
      return res.status(500).json({ error: 'Products could not be loaded.' })
    }
  })

  router.post('/products', async (req, res) => {
    const result = validateProductInput(req.body, { supabaseUrl, requireId: true })
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('products').insert(result.value).select('*').single()
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'That product ID is already in use.' })
        if (error.code === '23503') return res.status(400).json({ error: 'Create the selected category before adding this product.' })
        throw error
      }
      return res.status(201).json({ product: data })
    } catch (error) {
      console.error('Unable to create pharmacy product:', error.message)
      return res.status(500).json({ error: 'The product could not be saved.' })
    }
  })

  router.put('/products/:id', async (req, res) => {
    const result = validateProductInput(req.body, { supabaseUrl })
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('products')
        .update(result.value)
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle()
      if (error) {
        if (error.code === '23503') return res.status(400).json({ error: 'Create the selected category before moving this product.' })
        throw error
      }
      if (!data) return res.status(404).json({ error: 'This product no longer exists.' })
      return res.json({ product: data })
    } catch (error) {
      console.error('Unable to update pharmacy product:', error.message)
      return res.status(500).json({ error: 'The product could not be updated.' })
    }
  })

  router.delete('/products/:id', async (req, res) => {
    try {
      const { data, error } = await supabase.from('products')
        .update({ is_active: false })
        .eq('id', req.params.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'This product no longer exists.' })
      return res.json({ archived: true })
    } catch (error) {
      console.error('Unable to delete pharmacy product:', error.message)
      return res.status(500).json({ error: 'The product could not be deleted. Remove any order references first.' })
    }
  })

  router.post('/products/:id/image', express.raw({ type: Object.keys(imageTypes), limit: '5mb' }), async (req, res) => {
    const contentType = req.get('content-type') || ''
    const imageType = imageTypes[contentType]
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !imageType || !imageType.signature(req.body)) {
      return res.status(400).json({ error: 'Choose a valid JPEG, PNG, or WebP image (maximum 5 MB).' })
    }
    try {
      const { data: product, error: productError } = await supabase.from('products')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle()
      if (productError) throw productError
      if (!product) return res.status(404).json({ error: 'Save the product before uploading its image.' })

      const objectPath = `${product.id}/${randomUUID()}.${imageType.extension}`
      const { error: uploadError } = await supabase.storage.from('product-images')
        .upload(objectPath, req.body, { contentType, upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('product-images').getPublicUrl(objectPath)
      return res.status(201).json({ imageUrl: data.publicUrl })
    } catch (error) {
      console.error('Unable to upload pharmacy product image:', error.message)
      return res.status(500).json({ error: 'The product image could not be uploaded. Check the product-images storage bucket.' })
    }
  })

  router.get('/categories', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true })
      if (error) throw error
      return res.json({ categories: data })
    } catch (error) {
      console.error('Unable to list pharmacy categories:', error.message)
      return res.status(500).json({ error: 'Categories could not be loaded.' })
    }
  })

  router.post('/categories', async (req, res) => {
    const result = validateCategoryInput(req.body)
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('categories').insert(result.value).select('*').single()
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'That category already exists.' })
        throw error
      }
      return res.status(201).json({ category: data })
    } catch (error) {
      console.error('Unable to create pharmacy category:', error.message)
      return res.status(500).json({ error: 'The category could not be saved.' })
    }
  })

  router.put('/categories/:name', async (req, res) => {
    const result = validateCategoryInput(req.body)
    if (result.error) return res.status(400).json({ error: result.error })
    try {
      const { data, error } = await supabase.from('categories')
        .update(result.value)
        .eq('name', req.params.name)
        .select('*')
        .maybeSingle()
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'That category name is already in use.' })
        throw error
      }
      if (!data) return res.status(404).json({ error: 'This category no longer exists.' })
      return res.json({ category: data })
    } catch (error) {
      console.error('Unable to update pharmacy category:', error.message)
      return res.status(500).json({ error: 'The category could not be updated.' })
    }
  })

  router.delete('/categories/:name', async (req, res) => {
    try {
      const { data, error } = await supabase.from('categories')
        .delete()
        .eq('name', req.params.name)
        .select('name')
        .maybeSingle()
      if (error) {
        if (error.code === '23503') return res.status(409).json({ error: 'Move or delete this category’s products before removing it.' })
        throw error
      }
      if (!data) return res.status(404).json({ error: 'This category no longer exists.' })
      return res.json({ deleted: true })
    } catch (error) {
      console.error('Unable to delete pharmacy category:', error.message)
      return res.status(500).json({ error: 'The category could not be deleted.' })
    }
  })

  router.get('/orders', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return res.json({ orders: data })
    } catch (error) {
      console.error('Unable to list pharmacy orders:', error.message)
      return res.status(500).json({ error: 'Orders could not be loaded.' })
    }
  })

  router.patch('/orders/:id', async (req, res) => {
    const { status } = req.body ?? {}
    if (typeof status !== 'string' || !allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Choose a valid order status.' })
    }
    try {
      const { data, error } = await supabase.from('orders')
        .update({ status })
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'This order no longer exists.' })
      return res.json({ order: data })
    } catch (error) {
      console.error('Unable to update pharmacy order:', error.message)
      return res.status(500).json({ error: 'The order status could not be updated.' })
    }
  })

  return router
}
```

- [ ] **Step 8: Implement `server/app.js`**

```js
import express from 'express'
import path from 'node:path'
import { createAuth } from './lib/auth.js'
import { publicRoutes } from './routes/public.js'
import { adminRoutes } from './routes/admin.js'

export function createApp({ supabase = null, supabaseUrl = '', admins = new Set(), starter, clientDistPath }) {
  const app = express()
  const auth = createAuth({ supabase, admins })

  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      supabaseConfigured: Boolean(supabase),
      adminConfigured: Boolean(supabase && admins.size),
    })
  })

  app.use('/api', publicRoutes({ supabase, starter }))
  app.use('/api/admin', adminRoutes({ supabase, supabaseUrl, auth }))
  app.use('/api/admin', (_req, res) => res.status(404).json({ error: 'Admin endpoint not found.' }))

  app.use(express.static(clientDistPath))
  app.get('*path', (_req, res) => {
    res.sendFile(path.resolve(clientDistPath, 'index.html'), (error) => {
      if (error && !res.headersSent) {
        res.status(404).send('Build the storefront with npm run build before starting the production server.')
      }
    })
  })

  return app
}
```

- [ ] **Step 9: Replace `server/index.js`**

```js
import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
import { parseAdminEmails } from './lib/auth.js'
import { categories, products } from '../shared/catalog.js'

const port = Number(process.env.PORT) || 3001
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = createApp({
  supabase,
  supabaseUrl,
  admins: parseAdminEmails(process.env.ADMIN_EMAILS),
  starter: { products, categories },
  clientDistPath: path.resolve(__dirname, '..', 'dist', 'storefront'),
})

app.listen(port, () => {
  console.log(`Vitalight Pharmacy server listening on http://localhost:${port}`)
})
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run server`
Expected: PASS (all tests in `validate.test.js` and `app.test.js`).

- [ ] **Step 11: Smoke-test the real server**

Run: `node --check server/index.js && node -e "import('./server/app.js').then(()=>console.log('ok'))"`
Expected: prints `ok`.

- [ ] **Step 12: Commit**

```bash
git add server package.json package-lock.json
git commit -m "refactor: split Express API into app factory, routes and lib with tests"
```

---

### Task 4: Catalogue data, migrations and seed generator

**Files:**
- Create: `shared/catalog.js` (replaces the 17-line starter), `scripts/seedSql.js`, `scripts/generate-seed.js`, `supabase/migrations/001_catalogue_v2.sql`, `supabase/migrations/002_seed_catalogue.sql` (generated)
- Test: `shared/catalog.test.js`, `scripts/seedSql.test.js`
- Modify: `supabase/schema.sql` (append a note comment only)

**Interfaces:**
- Consumes: `ART_KEYS`, `COLOR_KEYS` from `shared/artKeys.js`.
- Produces:
  - `categories: {name, icon, description, sort_order}[]` (12)
  - `products: {id, name, category, brand, detail, price, oldPrice, tag, art, color, image_url, stock, featured, rx_required, sort_order}[]` (120)
  - `buildSeedSql(): string`

- [ ] **Step 1: Write failing tests**

`shared/catalog.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { categories, products } from './catalog.js'
import { ART_KEYS, COLOR_KEYS } from './artKeys.js'

describe('starter catalogue', () => {
  it('has 12 categories and about 120 products', () => {
    expect(categories).toHaveLength(12)
    expect(products.length).toBeGreaterThanOrEqual(110)
    expect(products.length).toBeLessThanOrEqual(130)
  })
  it('has unique, valid product ids', () => {
    const ids = products.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(60)
  })
  it('keeps the original seven product ids', () => {
    const ids = new Set(products.map((p) => p.id))
    for (const id of ['daily-vitamins', 'vitamin-c', 'gentle-cleanser', 'first-aid-kit', 'omega-3', 'digital-thermometer', 'oral-rehydration-salts']) {
      expect(ids.has(id)).toBe(true)
    }
  })
  it('every product satisfies the database constraints', () => {
    const categoryNames = new Set(categories.map((c) => c.name))
    for (const p of products) {
      expect(categoryNames.has(p.category), p.id).toBe(true)
      expect(ART_KEYS.includes(p.art), p.id).toBe(true)
      expect(COLOR_KEYS.includes(p.color), p.id).toBe(true)
      expect(Number.isInteger(p.price) && p.price >= 0, p.id).toBe(true)
      expect(p.oldPrice === null || (Number.isInteger(p.oldPrice) && p.oldPrice > p.price), p.id).toBe(true)
      expect(p.name.length >= 2 && p.name.length <= 120, p.id).toBe(true)
      expect(p.detail.length <= 240, p.id).toBe(true)
      expect(p.tag.length <= 30, p.id).toBe(true)
      expect(p.brand.length <= 60, p.id).toBe(true)
      expect(Number.isInteger(p.stock) && p.stock >= 0, p.id).toBe(true)
    }
  })
  it('every category has at least 8 products', () => {
    for (const c of categories) {
      expect(products.filter((p) => p.category === c.name).length, c.name).toBeGreaterThanOrEqual(8)
    }
  })
  it('category fields satisfy constraints', () => {
    for (const c of categories) {
      expect(c.name.length >= 2 && c.name.length <= 80).toBe(true)
      expect(c.description.length <= 160).toBe(true)
      expect(c.icon.length >= 1 && c.icon.length <= 8).toBe(true)
    }
  })
})
```

`scripts/seedSql.test.js`:
```js
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSeedSql } from './seedSql.js'
import { products, categories } from '../shared/catalog.js'

describe('buildSeedSql', () => {
  const sql = buildSeedSql()
  it('mentions every product id and category', () => {
    for (const p of products) expect(sql).toContain(`'${p.id}'`)
    for (const c of categories) expect(sql).toContain(c.name.replace(/'/g, "''"))
  })
  it('is idempotent', () => {
    expect(sql).toContain('on conflict (name) do update')
    expect(sql).toContain('on conflict (id) do nothing')
  })
  it('matches the committed migration file', () => {
    const committed = readFileSync(new URL('../supabase/migrations/002_seed_catalogue.sql', import.meta.url), 'utf8')
    expect(committed.replace(/\r\n/g, '\n')).toBe(sql)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run shared/catalog.test.js scripts`
Expected: FAIL (catalogue has 7 products / `seedSql.js` missing).

- [ ] **Step 3: Write `shared/catalog.js`**

Row tuple: `[id, name, brand, detail, price, oldPrice, tag, art, flags, color?]`. `flags` is a string: `r` = prescription required, `f` = featured, `o` = out of stock. `color` defaults to cycling lavender/peach/mint/blue by row index.

```js
const COLORS = ['lavender', 'peach', 'mint', 'blue']
let stockCounter = 0

function build(category, rows) {
  return rows.map(([id, name, brand, detail, price, oldPrice, tag, art, flags = '', color], index) => ({
    id,
    name,
    category,
    brand,
    detail,
    price,
    oldPrice,
    tag,
    art,
    color: color ?? COLORS[index % COLORS.length],
    image_url: null,
    stock: flags.includes('o') ? 0 : 6 + ((stockCounter++ * 11) % 44),
    featured: flags.includes('f'),
    rx_required: flags.includes('r'),
    sort_order: index,
  }))
}

export const categories = [
  { name: 'Medicines & pain relief', icon: '✚', description: 'Everyday relief essentials', sort_order: 0 },
  { name: 'Cold, flu & allergy', icon: '❄', description: 'Seasonal comfort', sort_order: 1 },
  { name: 'Digestive health', icon: '◎', description: 'Gut and stomach care', sort_order: 2 },
  { name: 'Vitamins & supplements', icon: '✳', description: 'Feel good, every day', sort_order: 3 },
  { name: 'Skin care & dermatology', icon: '❋', description: 'Cleanse, protect, soothe', sort_order: 4 },
  { name: 'Hair, body & personal care', icon: '✿', description: 'Care from head to toe', sort_order: 5 },
  { name: 'Mother & baby', icon: '♡', description: 'Gentle care for little ones', sort_order: 6 },
  { name: 'Sexual wellness & family planning', icon: '♥', description: 'Private, discreet care', sort_order: 7 },
  { name: 'Diabetes & heart care', icon: '⚕', description: 'Monitor and manage', sort_order: 8 },
  { name: 'First aid & wound care', icon: '✜', description: 'Be ready for anything', sort_order: 9 },
  { name: 'Health devices & diagnostics', icon: '⌁', description: 'Wellness at home', sort_order: 10 },
  { name: 'Fitness & nutrition', icon: '❖', description: 'Fuel an active life', sort_order: 11 },
]

export const products = [
  ...build('Medicines & pain relief', [
    ['paracetamol-500mg', 'Paracetamol 500 mg Tablets', 'Vitalight', '24 tablets · pain and fever relief', 1200, null, 'PHARMACIST PICK', 'strip', 'f'],
    ['ibuprofen-400mg', 'Ibuprofen 400 mg Tablets', 'Vitalight', '20 tablets · take with food', 1800, null, '', 'strip'],
    ['diclofenac-gel', 'Diclofenac Pain Relief Gel', 'Vitalight', '50 g tube · for muscles and joints', 3200, 3800, 'SAVE 16%', 'tube'],
    ['oral-rehydration-salts', 'Oral Rehydration Salts', 'Vitalight', 'Single-use sachets · ask our pharmacist', 1200, null, 'PHARMACIST PICK', 'medicine', '', 'mint'],
    ['menthol-balm', 'Menthol Pain Relief Balm', 'PureLeaf', '30 g jar · warming rub', 1500, null, '', 'jar'],
    ['amoxicillin-500mg', 'Amoxicillin 500 mg Capsules', 'Vitalight', '21 capsules · prescription required', 4500, null, 'RX', 'medicine', 'r'],
    ['paracetamol-suspension', 'Paracetamol Oral Suspension', 'Vitalight', '100 ml · for children', 1600, null, '', 'vitamin'],
    ['naproxen-250mg', 'Naproxen 250 mg Tablets', 'Vitalight', '30 tablets · prescription required', 3800, null, 'RX', 'strip', 'r'],
    ['pain-relief-patches', 'Warming Pain Relief Patches', 'PureLeaf', '5 patches · back and shoulder', 2800, 3200, 'NEW', 'box'],
    ['headache-relief-caplets', 'Extra Strength Headache Relief', 'Vitalight', '16 caplets', 2400, null, '', 'strip'],
  ]),
  ...build('Cold, flu & allergy', [
    ['cetirizine-10mg', 'Cetirizine 10 mg Tablets', 'Vitalight', '10 tablets · allergy relief', 1400, null, 'ALLERGY', 'strip', 'f'],
    ['soothing-cough-syrup', 'Soothing Cough Syrup', 'PureLeaf', '100 ml · dry and chesty cough', 2200, null, '', 'vitamin'],
    ['honey-lemon-lozenges', 'Honey & Lemon Throat Lozenges', 'PureLeaf', '24 lozenges', 1500, null, '', 'box'],
    ['saline-nasal-spray', 'Saline Nasal Spray', 'Vitalight', '30 ml · gentle daily rinse', 2600, null, '', 'spray'],
    ['cold-flu-tablets', 'Cold & Flu Relief Tablets', 'Vitalight', '12 tablets · day relief', 2000, 2400, 'SAVE 17%', 'strip'],
    ['loratadine-10mg', 'Loratadine 10 mg Tablets', 'Vitalight', '10 tablets · non-drowsy', 1600, null, '', 'strip'],
    ['steam-inhalation-capsules', 'Steam Inhalation Capsules', 'PureLeaf', '10 capsules', 1800, null, '', 'box'],
    ['soothing-eye-drops', 'Soothing Eye Drops', 'Vitalight', '10 ml · tired, dry eyes', 2900, null, '', 'dropper'],
    ['chest-rub', 'Vapour Chest Rub', 'PureLeaf', '50 g jar', 1900, null, '', 'jar'],
    ['hand-sanitiser-gel', 'Hand Sanitiser Gel', 'Vitalight', '250 ml · 70% alcohol', 1700, 2000, 'SAVE 15%', 'cleanser'],
  ]),
  ...build('Digestive health', [
    ['antacid-chewables', 'Antacid Chewable Tablets', 'Vitalight', '24 tablets · mint flavour', 1300, null, '', 'strip'],
    ['anti-diarrhoea-capsules', 'Anti-Diarrhoea Capsules', 'Vitalight', '6 capsules', 1500, null, '', 'strip'],
    ['daily-probiotic', 'Daily Probiotic Capsules', 'NutriBloom', '30 capsules · gut balance', 9800, 11500, 'POPULAR', 'vitamin', 'f'],
    ['gentle-laxative', 'Gentle Laxative Tablets', 'Vitalight', '20 tablets', 1400, null, '', 'strip'],
    ['infant-wind-drops', 'Infant Wind Relief Drops', 'Vitalight', '30 ml', 2300, null, '', 'dropper'],
    ['fibre-sachets', 'Daily Fibre Sachets', 'NutriBloom', '14 sachets', 4200, null, 'NEW', 'sachet'],
    ['omeprazole-20mg', 'Omeprazole 20 mg Capsules', 'Vitalight', '14 capsules · prescription required', 3500, null, 'RX', 'strip', 'r'],
    ['ginger-digestive-tea', 'Ginger Digestive Tea', 'PureLeaf', '20 tea bags', 1800, null, '', 'box'],
    ['family-deworming', 'Family Deworming Tablet', 'Vitalight', '1 tablet', 1100, null, '', 'strip'],
    ['stomach-cramp-tablets', 'Stomach Cramp Relief Tablets', 'Vitalight', '20 tablets', 1700, null, '', 'strip'],
  ]),
  ...build('Vitamins & supplements', [
    ['daily-vitamins', 'Daily Essentials Multivitamin', 'NutriBloom', '30 tablets · everyday wellness', 8500, 10000, 'BESTSELLER', 'vitamin', 'f', 'lavender'],
    ['vitamin-c', 'Vitamin C + Zinc', 'NutriBloom', 'Effervescent · 20 tablets', 6200, null, 'IMMUNITY', 'vitaminc', 'f', 'peach'],
    ['omega-3', 'Omega 3 Fish Oil', 'NutriBloom', '60 softgels', 15800, null, 'POPULAR', 'omega', 'f', 'peach'],
    ['vitamin-d3-1000', 'Vitamin D3 1000 IU', 'NutriBloom', '60 softgels', 7200, null, '', 'vitamin'],
    ['vitamin-b-complex', 'Vitamin B Complex', 'NutriBloom', '60 tablets', 5400, null, '', 'vitaminc'],
    ['magnesium-citrate', 'Magnesium Citrate', 'NutriBloom', '60 capsules', 8300, 9500, 'SAVE 13%', 'omega'],
    ['iron-folic-acid', 'Iron + Folic Acid', 'NutriBloom', '30 tablets', 3600, null, '', 'vitamin'],
    ['calcium-vitamin-d', 'Calcium + Vitamin D', 'NutriBloom', '60 tablets', 6800, null, '', 'vitaminc'],
    ['zinc-50mg', 'Zinc 50 mg', 'NutriBloom', '30 tablets', 3900, null, '', 'vitamin'],
    ['kids-chewable-multivitamin', 'Kids Chewable Multivitamin', 'BabyBloom', '60 chewables', 6400, null, 'NEW', 'jar'],
  ]),
  ...build('Skin care & dermatology', [
    ['gentle-cleanser', 'Gentle Hydrating Cleanser', 'DermaCalm', 'Sensitive skin · 200 ml', 12400, 14500, 'GENTLE CARE', 'cleanser', 'f', 'mint'],
    ['daily-moisturising-cream', 'Daily Moisturising Cream', 'DermaCalm', '250 ml', 6800, null, '', 'jar'],
    ['sunscreen-spf50', 'Sunscreen SPF 50', 'DermaCalm', '75 ml · lightweight', 9500, null, 'NEW', 'tube', 'f'],
    ['hydrocortisone-cream', 'Hydrocortisone 1% Cream', 'DermaCalm', '15 g · itch relief', 2200, null, '', 'tube'],
    ['clear-skin-acne-gel', 'Clear Skin Acne Gel', 'DermaCalm', '30 g', 4800, null, '', 'tube'],
    ['nourishing-lip-balm', 'Nourishing Lip Balm SPF 15', 'DermaCalm', '4.8 g', 1100, null, '', 'tube'],
    ['shea-body-lotion', 'Shea Body Lotion', 'DermaCalm', '400 ml', 5200, 6000, 'SAVE 13%', 'cleanser'],
    ['antifungal-cream', 'Antifungal Cream', 'Vitalight', '20 g', 2400, null, '', 'tube'],
    ['vitamin-c-serum', 'Vitamin C Brightening Serum', 'DermaCalm', '30 ml', 11500, null, '', 'dropper'],
    ['aloe-vera-gel', 'Soothing Aloe Vera Gel', 'PureLeaf', '200 ml', 3400, null, '', 'tube'],
  ]),
  ...build('Hair, body & personal care', [
    ['nourishing-shampoo', 'Nourishing Shampoo', 'PureLeaf', '400 ml', 4500, null, '', 'cleanser'],
    ['moisture-conditioner', 'Moisture Conditioner', 'PureLeaf', '400 ml', 4700, null, '', 'cleanser'],
    ['fluoride-toothpaste', 'Fluoride Toothpaste', 'Vitalight', '100 ml', 1300, null, '', 'tube', 'f'],
    ['antibacterial-mouthwash', 'Antibacterial Mouthwash', 'Vitalight', '500 ml', 3100, null, '', 'vitamin'],
    ['soft-toothbrush-2pk', 'Soft Toothbrush 2-pack', 'Vitalight', '2 brushes', 1400, null, '', 'box'],
    ['roll-on-deodorant', 'Roll-on Deodorant', 'PureLeaf', '50 ml', 2200, null, '', 'cleanser'],
    ['gentle-body-wash', 'Gentle Body Wash', 'PureLeaf', '500 ml', 3800, 4400, 'SAVE 14%', 'cleanser'],
    ['ultra-sanitary-pads', 'Ultra Sanitary Pads', 'PureLeaf', '16 pads', 1800, null, '', 'box'],
    ['cotton-buds', 'Cotton Buds', 'Vitalight', '200 buds', 900, null, '', 'box'],
    ['disposable-razors-5pk', 'Disposable Razors 5-pack', 'Vitalight', '5 razors', 1500, null, '', 'box'],
  ]),
  ...build('Mother & baby', [
    ['baby-diapers-m', 'Baby Diapers Size M', 'BabyBloom', '40 pieces', 8800, 9800, 'SAVE 10%', 'box', 'f'],
    ['sensitive-baby-wipes', 'Sensitive Baby Wipes', 'BabyBloom', '72 wipes', 2200, null, '', 'box'],
    ['gentle-baby-lotion', 'Gentle Baby Lotion', 'BabyBloom', '300 ml', 3900, null, '', 'cleanser'],
    ['baby-powder', 'Baby Powder', 'BabyBloom', '200 g', 2100, null, '', 'jar'],
    ['tear-free-baby-shampoo', 'Tear-free Baby Shampoo', 'BabyBloom', '250 ml', 3300, null, '', 'cleanser'],
    ['nappy-rash-cream', 'Nappy Rash Cream', 'BabyBloom', '50 g', 2700, null, '', 'tube'],
    ['infant-formula-stage-1', 'Infant Formula Stage 1', 'BabyBloom', '400 g tin', 9500, null, '', 'jar'],
    ['anti-colic-feeding-bottle', 'Anti-colic Feeding Bottle', 'BabyBloom', '260 ml', 4200, null, 'NEW', 'vitamin'],
    ['prenatal-multivitamin', 'Prenatal Multivitamin', 'NutriBloom', '30 tablets', 6900, null, '', 'vitamin'],
    ['disposable-nursing-pads', 'Disposable Nursing Pads', 'BabyBloom', '30 pads', 3100, null, '', 'box'],
  ]),
  ...build('Sexual wellness & family planning', [
    ['ultra-thin-condoms-12', 'Ultra-thin Condoms 12-pack', 'Vitalight', '12 pieces', 2600, null, '', 'box'],
    ['condoms-3', 'Condoms 3-pack', 'Vitalight', '3 pieces', 900, null, '', 'box'],
    ['rapid-pregnancy-test', 'Rapid Pregnancy Test', 'Vitalight', '1 test', 1200, null, '', 'strip'],
    ['ovulation-test-strips', 'Ovulation Test Strips', 'Vitalight', '7 strips', 4500, null, '', 'strip'],
    ['water-based-lubricant', 'Water-based Lubricant', 'Vitalight', '50 ml', 2800, null, '', 'tube'],
    ['emergency-contraceptive', 'Emergency Contraceptive Tablet', 'Vitalight', '1 tablet · pharmacist guidance', 3500, null, 'RX', 'strip', 'r'],
    ['gentle-feminine-wash', 'Gentle Feminine Wash', 'PureLeaf', '250 ml', 3200, null, '', 'cleanser'],
    ['intimate-wipes', 'Intimate Wipes', 'PureLeaf', '20 wipes', 1600, null, '', 'box'],
    ['combined-oral-contraceptive', 'Combined Oral Contraceptive', 'Vitalight', '21 tablets · prescription required', 2400, null, 'RX', 'strip', 'r'],
    ['menstrual-pain-tablets', 'Menstrual Pain Relief Tablets', 'Vitalight', '12 tablets', 1900, null, '', 'strip'],
  ]),
  ...build('Diabetes & heart care', [
    ['glucometer-kit', 'Blood Glucose Monitor Kit', 'Vitalight', 'Meter + 10 strips', 18500, 21000, 'SAVE 12%', 'device', 'f'],
    ['glucose-test-strips-50', 'Glucose Test Strips', 'Vitalight', '50 strips', 12500, null, '', 'strip'],
    ['sterile-lancets-100', 'Sterile Lancets', 'Vitalight', '100 lancets', 3200, null, '', 'box'],
    ['metformin-500mg', 'Metformin 500 mg Tablets', 'Vitalight', '30 tablets · prescription required', 2800, null, 'RX', 'strip', 'r'],
    ['amlodipine-5mg', 'Amlodipine 5 mg Tablets', 'Vitalight', '30 tablets · prescription required', 3000, null, 'RX', 'strip', 'r'],
    ['lisinopril-10mg', 'Lisinopril 10 mg Tablets', 'Vitalight', '30 tablets · prescription required', 3300, null, 'RX', 'strip', 'r'],
    ['upper-arm-bp-monitor', 'Upper Arm Blood Pressure Monitor', 'HeartWise', '1 device', 24500, null, '', 'device'],
    ['low-dose-aspirin-75mg', 'Low Dose Aspirin 75 mg', 'Vitalight', '28 tablets', 1900, null, '', 'strip'],
    ['sugar-free-sweetener', 'Sugar-free Sweetener Tablets', 'HeartWise', '300 tablets', 1800, null, '', 'box'],
    ['coq10-100mg', 'CoQ10 100 mg', 'HeartWise', '30 softgels', 12800, null, '', 'omega'],
  ]),
  ...build('First aid & wound care', [
    ['first-aid-kit', 'Everyday First Aid Kit', 'Vitalight', '12 essentials · home and travel', 9800, null, 'JUST IN', 'firstaid', 'f', 'blue'],
    ['assorted-plasters', 'Assorted Adhesive Plasters', 'Vitalight', '40 pieces', 1300, null, '', 'box'],
    ['antiseptic-liquid', 'Antiseptic Liquid', 'Vitalight', '250 ml', 1900, null, '', 'vitamin'],
    ['sterile-gauze-dressings', 'Sterile Gauze Dressings', 'Vitalight', '10 pieces', 1700, null, '', 'box'],
    ['crepe-bandage-7-5cm', 'Crepe Bandage 7.5 cm', 'Vitalight', '1 bandage', 900, null, '', 'box'],
    ['cotton-wool-100g', 'Cotton Wool', 'Vitalight', '100 g', 1000, null, '', 'box'],
    ['micropore-tape', 'Micropore Tape', 'Vitalight', '1 roll', 800, null, '', 'box'],
    ['burn-relief-gel', 'Burn Relief Gel', 'Vitalight', '30 g', 2400, null, '', 'tube'],
    ['saline-wound-wash', 'Saline Wound Wash', 'Vitalight', '100 ml', 1600, null, '', 'spray'],
    ['instant-cold-pack', 'Instant Cold Pack', 'Vitalight', '1 pack', 1400, null, '', 'sachet'],
  ]),
  ...build('Health devices & diagnostics', [
    ['digital-thermometer', 'Digital Thermometer', 'Vitalight', 'Fast reading · easy to use', 7500, null, 'AT-HOME CARE', 'device', 'f', 'lavender'],
    ['infrared-thermometer', 'Infrared Forehead Thermometer', 'Vitalight', 'Non-contact', 15500, null, '', 'device'],
    ['fingertip-pulse-oximeter', 'Fingertip Pulse Oximeter', 'HeartWise', '1 device', 14500, null, '', 'device'],
    ['compressor-nebuliser', 'Compressor Nebuliser', 'Vitalight', '1 device', 32000, null, '', 'device'],
    ['digital-bathroom-scale', 'Digital Bathroom Scale', 'Vitalight', '1 scale', 12800, 14500, 'SAVE 12%', 'device'],
    ['hot-water-bottle-2l', 'Hot Water Bottle 2 L', 'Vitalight', '2 litres', 3200, null, '', 'jar'],
    ['electric-heating-pad', 'Electric Heating Pad', 'Vitalight', '1 pad', 11500, null, '', 'device'],
    ['disposable-face-masks-50', 'Disposable Face Masks', 'Vitalight', '50 masks', 2500, null, '', 'box'],
    ['urine-test-strips-10', 'Urine Test Strips', 'Vitalight', '10 strips', 2100, null, '', 'strip'],
    ['personal-steam-inhaler', 'Personal Steam Inhaler', 'Vitalight', '1 device', 9800, null, '', 'device'],
  ]),
  ...build('Fitness & nutrition', [
    ['whey-protein-1kg', 'Whey Protein', 'NutriBloom', '1 kg tub', 38000, 42000, 'SAVE 10%', 'jar', 'f'],
    ['meal-replacement-shake', 'Meal Replacement Shake', 'NutriBloom', '500 g tub', 14800, null, '', 'jar'],
    ['creatine-monohydrate', 'Creatine Monohydrate', 'NutriBloom', '300 g tub', 16500, null, '', 'jar'],
    ['electrolyte-sachets-10', 'Electrolyte Drink Sachets', 'NutriBloom', '10 sachets', 3800, null, '', 'sachet'],
    ['protein-bars-12', 'Protein Bars 12-pack', 'NutriBloom', '12 bars', 12500, null, 'NEW', 'box'],
    ['green-tea-25', 'Green Tea', 'PureLeaf', '25 tea bags', 2400, null, '', 'box'],
    ['collagen-peptides-sachets', 'Collagen Peptides', 'NutriBloom', '30 sachets', 14500, null, '', 'sachet'],
    ['resistance-band-set', 'Resistance Band Set', 'Vitalight', '3 bands', 9500, null, '', 'box'],
    ['sports-water-bottle-750', 'Sports Water Bottle', 'Vitalight', '750 ml', 3500, null, '', 'vitamin'],
    ['apple-cider-vinegar-gummies', 'Apple Cider Vinegar Gummies', 'NutriBloom', '60 gummies', 7800, null, '', 'jar'],
  ]),
]
```

- [ ] **Step 4: Write `scripts/seedSql.js`**

```js
import { categories, products } from '../shared/catalog.js'

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`
const nullable = (value) => (value === null || value === undefined ? 'null' : value)

export function buildSeedSql() {
  const categoryRows = categories
    .map((c) => `  (${quote(c.name)}, ${quote(c.description)}, ${quote(c.icon)}, ${c.sort_order})`)
    .join(',\n')

  const productRows = products
    .map((p) => `  (${[
      quote(p.id), quote(p.name), quote(p.category), quote(p.brand), quote(p.detail),
      p.price, nullable(p.oldPrice), quote(p.tag), quote(p.art), quote(p.color),
      p.stock, p.featured, p.rx_required, p.sort_order,
    ].join(', ')})`)
    .join(',\n')

  return `-- GENERATED by scripts/generate-seed.js from shared/catalog.js. Do not edit by hand.
-- Run after 001_catalogue_v2.sql. Re-running resets category descriptions/order but never
-- overwrites existing products.

insert into public.categories (name, description, icon, sort_order)
values
${categoryRows}
on conflict (name) do update
set description = excluded.description,
    icon = excluded.icon,
    sort_order = excluded.sort_order;

insert into public.products (id, name, category, brand, detail, price, old_price, tag, art, color, stock, featured, rx_required, sort_order)
values
${productRows}
on conflict (id) do nothing;
`
}
```

- [ ] **Step 5: Write `scripts/generate-seed.js`**

```js
import { writeFileSync } from 'node:fs'
import { buildSeedSql } from './seedSql.js'

const target = new URL('../supabase/migrations/002_seed_catalogue.sql', import.meta.url)
writeFileSync(target, buildSeedSql())
console.log(`Wrote ${target.pathname}`)
```

- [ ] **Step 6: Write `supabase/migrations/001_catalogue_v2.sql`**

```sql
-- Catalogue v2: richer product fields, more illustration types, new category set.
-- Safe to re-run.

alter table public.products
  add column if not exists brand text not null default '' check (char_length(brand) <= 60);
alter table public.products
  add column if not exists rx_required boolean not null default false;
alter table public.products
  add column if not exists sort_order integer not null default 0 check (sort_order between 0 and 999);

alter table public.products drop constraint if exists products_art_check;
alter table public.products
  add constraint products_art_check check (art in (
    'vitamin', 'vitaminc', 'cleanser', 'firstaid', 'omega', 'device', 'medicine',
    'tube', 'sachet', 'strip', 'dropper', 'spray', 'jar', 'box'
  ));

-- Rename legacy categories. Products follow automatically (ON UPDATE CASCADE).
update public.categories set name = 'Medicines & pain relief' where name = 'Medicines';
update public.categories set name = 'Skin care & dermatology' where name = 'Personal care';
update public.categories set name = 'First aid & wound care' where name = 'First aid';
update public.categories set name = 'Health devices & diagnostics' where name = 'Health devices';

create index if not exists products_category_idx on public.products (category);
create index if not exists products_active_idx on public.products (is_active);
```

- [ ] **Step 7: Generate the seed file**

Run: `node scripts/generate-seed.js`
Expected: `Wrote .../supabase/migrations/002_seed_catalogue.sql`

- [ ] **Step 8: Append a pointer comment to `supabase/schema.sql`**

Append at the end:
```sql

-- After running this file, run supabase/migrations/001_catalogue_v2.sql and then
-- supabase/migrations/002_seed_catalogue.sql in the Supabase SQL editor.
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run shared scripts`
Expected: PASS. If the "matches the committed migration file" test fails on line endings, re-run Step 7 (the test normalises `\r\n`).

- [ ] **Step 10: Commit**

```bash
git add shared scripts supabase
git commit -m "feat: 120-product catalogue across 12 categories with SQL migrations"
```

---

### Task 5: Product artwork component

**Files:**
- Create: `shared/art/ProductArt.jsx`
- Test: `shared/art/ProductArt.test.jsx`

**Interfaces:**
- Consumes: `ART_KEYS` from `shared/artKeys.js`.
- Produces: default export `ProductArt({ type, color?, imageUrl?, name?, className? })`. Renders `<div class="product-art ...">` containing either `<img>` (when `imageUrl`) or `<svg role="img" aria-label=name>`. Unknown `type` falls back to `vitamin`.

- [ ] **Step 1: Write failing test**

`shared/art/ProductArt.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ProductArt from './ProductArt.jsx'
import { ART_KEYS } from '../artKeys.js'

describe('ProductArt', () => {
  it('renders an svg for every art key', () => {
    for (const key of ART_KEYS) {
      const { container, unmount } = render(<ProductArt type={key} name={key} />)
      expect(container.querySelector('svg'), key).not.toBeNull()
      expect(container.querySelectorAll('svg *').length, key).toBeGreaterThan(2)
      unmount()
    }
  })
  it('falls back to the bottle for unknown types', () => {
    const { container } = render(<ProductArt type="unicorn" name="x" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
  it('prefers an uploaded photo over artwork', () => {
    const { container } = render(<ProductArt type="vitamin" imageUrl="https://example.com/a.png" name="Photo" />)
    expect(container.querySelector('img').getAttribute('src')).toBe('https://example.com/a.png')
    expect(container.querySelector('svg')).toBeNull()
  })
  it('exposes the product name as the accessible label', () => {
    const { getByRole } = render(<ProductArt type="tube" name="Sunscreen" />)
    expect(getByRole('img').getAttribute('aria-label')).toBe('Sunscreen')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run shared/art`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `shared/art/ProductArt.jsx`**

```jsx
import { ART_KEYS } from '../artKeys.js'

const NAVY = '#0b2a50'
const PINK = '#fd3f92'
const BACKGROUNDS = { lavender: '#eef1f8', peach: '#fff0f6', mint: '#e9f6f3', blue: '#e8f0fb' }
const line = { stroke: NAVY, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }

const shapes = {
  vitamin: () => (<>
    <rect x="52" y="58" width="56" height="72" rx="10" fill="#fff" {...line} />
    <rect x="58" y="38" width="44" height="22" rx="5" fill={NAVY} />
    <rect x="60" y="78" width="40" height="30" rx="4" fill={PINK} />
    <path d="M80 84v18M71 93h18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </>),
  vitaminc: () => (<>
    <rect x="38" y="68" width="84" height="62" rx="12" fill="#fff" {...line} />
    <rect x="44" y="46" width="72" height="24" rx="6" fill={PINK} />
    <rect x="50" y="84" width="60" height="30" rx="4" fill={NAVY} />
    <circle cx="80" cy="99" r="7" fill="#fff" />
  </>),
  cleanser: () => (<>
    <rect x="56" y="64" width="48" height="68" rx="12" fill="#fff" {...line} />
    <rect x="74" y="38" width="12" height="28" fill={NAVY} />
    <rect x="72" y="32" width="32" height="10" rx="5" fill={NAVY} />
    <rect x="60" y="86" width="40" height="22" rx="4" fill={PINK} />
  </>),
  firstaid: () => (<>
    <rect x="30" y="58" width="100" height="68" rx="10" fill="#fff" {...line} />
    <path d="M64 58v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8" fill="none" {...line} />
    <rect x="74" y="74" width="12" height="36" rx="2" fill={PINK} />
    <rect x="62" y="86" width="36" height="12" rx="2" fill={PINK} />
  </>),
  omega: () => (<>
    <rect x="42" y="72" width="76" height="58" rx="10" fill="#fff" {...line} />
    <rect x="38" y="52" width="84" height="24" rx="8" fill={NAVY} />
    <rect x="50" y="88" width="60" height="28" rx="4" fill={PINK} />
    <circle cx="80" cy="102" r="8" fill="#fff" />
  </>),
  device: () => (
    <g transform="rotate(-35 80 80)">
      <rect x="68" y="20" width="24" height="108" rx="12" fill="#fff" {...line} />
      <rect x="73" y="40" width="14" height="26" rx="3" fill={PINK} />
      <circle cx="80" cy="112" r="7" fill={NAVY} />
    </g>
  ),
  medicine: () => (<>
    <rect x="38" y="58" width="84" height="64" rx="6" fill="#fff" {...line} />
    <rect x="38" y="58" width="84" height="20" rx="6" fill={NAVY} />
    <path d="M80 88v22M69 99h22" stroke={PINK} strokeWidth="6" strokeLinecap="round" />
  </>),
  tube: () => (<>
    <path d="M62 40h36l4 78a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4z" fill="#fff" {...line} />
    <rect x="60" y="30" width="40" height="12" rx="3" fill={NAVY} />
    <rect x="62" y="124" width="36" height="12" rx="3" fill={NAVY} />
    <rect x="62" y="68" width="36" height="26" fill={PINK} />
  </>),
  sachet: () => (<>
    <rect x="46" y="44" width="68" height="88" rx="4" fill="#fff" {...line} />
    <path d="M46 52h68M46 124h68" stroke={NAVY} strokeWidth="3" strokeDasharray="4 4" />
    <circle cx="80" cy="88" r="16" fill={PINK} />
    <path d="M80 80v16M72 88h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </>),
  strip: () => (<>
    <rect x="30" y="54" width="100" height="52" rx="8" fill="#fff" {...line} />
    {[0, 1, 2, 3].map((i) => <circle key={`a${i}`} cx={48 + i * 22} cy="70" r="7" fill={PINK} />)}
    {[0, 1, 2, 3].map((i) => <circle key={`b${i}`} cx={48 + i * 22} cy="92" r="7" fill={PINK} opacity=".55" />)}
  </>),
  dropper: () => (<>
    <rect x="54" y="74" width="52" height="56" rx="10" fill="#fff" {...line} />
    <rect x="68" y="60" width="24" height="16" fill={NAVY} />
    <ellipse cx="80" cy="42" rx="11" ry="20" fill={PINK} />
    <rect x="62" y="92" width="36" height="20" rx="3" fill={NAVY} />
  </>),
  spray: () => (<>
    <rect x="56" y="72" width="48" height="58" rx="10" fill="#fff" {...line} />
    <rect x="72" y="52" width="16" height="22" fill={NAVY} />
    <rect x="68" y="38" width="42" height="14" rx="6" fill={PINK} />
    <rect x="62" y="92" width="36" height="20" rx="3" fill={NAVY} />
  </>),
  jar: () => (<>
    <rect x="40" y="76" width="80" height="54" rx="14" fill="#fff" {...line} />
    <rect x="36" y="56" width="88" height="24" rx="8" fill={NAVY} />
    <rect x="50" y="92" width="60" height="24" rx="4" fill={PINK} />
  </>),
  box: () => (<>
    <rect x="36" y="48" width="88" height="82" rx="6" fill="#fff" {...line} />
    <rect x="36" y="48" width="22" height="82" rx="6" fill={NAVY} />
    <rect x="68" y="66" width="46" height="8" rx="4" fill={PINK} />
    <rect x="68" y="84" width="34" height="6" rx="3" fill={NAVY} opacity=".35" />
    <rect x="68" y="98" width="40" height="6" rx="3" fill={NAVY} opacity=".35" />
  </>),
}

export default function ProductArt({ type, color = 'lavender', imageUrl, name = '', className = '' }) {
  if (imageUrl) {
    return (
      <div className={`product-art has-photo ${className}`.trim()}>
        <img src={imageUrl} alt={name} loading="lazy" />
      </div>
    )
  }
  const Shape = shapes[ART_KEYS.includes(type) ? type : 'vitamin']
  return (
    <div className={`product-art ${className}`.trim()} style={{ background: BACKGROUNDS[color] || BACKGROUNDS.lavender }}>
      <svg viewBox="0 0 160 160" role="img" aria-label={name || 'Product illustration'}>
        <ellipse cx="80" cy="140" rx="36" ry="5" fill={NAVY} opacity=".08" />
        <Shape />
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run shared/art`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/art
git commit -m "feat: add branded SVG product artwork component"
```

---

### Task 6: Brand system, providers, layout shell

**Files:**
- Delete: `storefront/src/styles.css`, replace `storefront/src/App.jsx`, `storefront/src/main.jsx`
- Create: `storefront/src/config.js`, `storefront/src/api.js`, `storefront/src/styles/{tokens,base,components,pages}.css`, `storefront/src/context/{CatalogContext,StoreContext}.jsx`, `storefront/src/components/{Layout,Header,Footer,Toast}.jsx`, `storefront/src/pages/NotFoundPage.jsx`
- Test: `storefront/src/context/CatalogContext.test.jsx`, `storefront/src/context/StoreContext.test.jsx`

**Interfaces:**
- Consumes: Task 2 (`cartReducer`, `cartLines`, `cartTotals`, `categorySlug`), Task 4 (`categories`, `products`), Task 5 (`ProductArt`).
- Produces:
  - `useCatalog(): { products, categories, status: 'loading'|'live'|'sample', productById(id), categoryBySlug(slug) }`
  - `useStore(): { cart, lines, totals, saved, cartOpen, orderOpen, notice, add(id, qty?), setQty(id, qty), remove(id), clearCart(), toggleSaved(id), isSaved(id), openCart(), closeCart(), openOrder(), closeOrder(), notify(msg) }`
  - `<Layout>` wraps routes with Header, Footer, `CartDrawer`, `OrderModal`, `Toast` (the latter two are created in Task 10; Layout imports them from Task 10 files, so this task creates empty-but-valid stubs, see Step 9).
  - `api.js`: `fetchCatalog(signal)`, `submitOrder(payload) -> {orderId}`.
  - `config.js`: `contact: {phone, whatsapp, email}`.

- [ ] **Step 1: Write failing tests**

`storefront/src/context/CatalogContext.test.jsx`:
```jsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CatalogProvider, useCatalog } from './CatalogContext.jsx'

function Probe() {
  const { products, status } = useCatalog()
  return <p>{status}:{products.length}:{products[0]?.id}</p>
}

afterEach(() => vi.restoreAllMocks())

describe('CatalogProvider', () => {
  it('falls back to the bundled sample catalogue when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText(/^sample:/)).toBeTruthy())
    expect(Number(screen.getByText(/^sample:/).textContent.split(':')[1])).toBeGreaterThan(100)
  })
  it('uses live products when the API responds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ id: 'live-1', name: 'Live', category: 'C', price: 1, stock: 1 }],
        categories: [{ name: 'C', icon: 'x', description: '' }],
      }),
    })
    render(<CatalogProvider><Probe /></CatalogProvider>)
    await waitFor(() => expect(screen.getByText('live:1:live-1')).toBeTruthy())
  })
})
```

`storefront/src/context/StoreContext.test.jsx`:
```jsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CatalogProvider } from './CatalogContext.jsx'
import { StoreProvider, useStore } from './StoreContext.jsx'

function Probe() {
  const { totals, add, toggleSaved, saved, clearCart } = useStore()
  return (
    <div>
      <span data-testid="count">{totals.count}</span>
      <span data-testid="saved">{saved.length}</span>
      <button onClick={() => add('paracetamol-500mg')}>add</button>
      <button onClick={() => toggleSaved('paracetamol-500mg')}>save</button>
      <button onClick={clearCart}>clear</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup() {
  return render(<CatalogProvider><StoreProvider><Probe /></StoreProvider></CatalogProvider>)
}

describe('StoreProvider', () => {
  it('adds, saves and clears', () => {
    setup()
    fireEvent.click(screen.getByText('add'))
    fireEvent.click(screen.getByText('add'))
    expect(screen.getByTestId('count').textContent).toBe('2')
    fireEvent.click(screen.getByText('save'))
    expect(screen.getByTestId('saved').textContent).toBe('1')
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
  it('persists the cart to localStorage and restores it', () => {
    const first = setup()
    fireEvent.click(screen.getByText('add'))
    first.unmount()
    setup()
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
  it('survives corrupt localStorage', () => {
    localStorage.setItem('vitalight.cart', '{not json')
    setup()
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run storefront`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `storefront/src/config.js` and `storefront/src/api.js`**

`config.js`:
```js
const env = import.meta.env

export const contact = {
  phone: env.VITE_PHARMACY_PHONE || '',
  whatsapp: (env.VITE_PHARMACY_WHATSAPP || '').replace(/[^\d]/g, ''),
  email: env.VITE_PHARMACY_EMAIL || 'hello@vitalightpharmacy.com',
}
```

`api.js`:
```js
async function readError(response, fallback) {
  try {
    const body = await response.json()
    return body.error || fallback
  } catch {
    return fallback
  }
}

export async function fetchCatalog(signal) {
  const response = await fetch('/api/catalog', { signal })
  if (!response.ok) throw new Error(await readError(response, 'The live catalogue could not be loaded.'))
  return response.json()
}

export async function submitOrder(payload) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await readError(response, 'We could not submit your request.'))
  return response.json()
}
```

- [ ] **Step 4: Write the contexts**

`storefront/src/context/CatalogContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { categories as starterCategories, products as starterProducts } from '../../../shared/catalog.js'
import { findCategoryBySlug } from '../../../shared/catalogTools.js'
import { fetchCatalog } from '../api.js'

const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState({ products: starterProducts, categories: starterCategories })
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalog(controller.signal)
      .then((result) => {
        setCatalog({
          products: Array.isArray(result.products) && result.products.length ? result.products : starterProducts,
          categories: Array.isArray(result.categories) && result.categories.length ? result.categories : starterCategories,
        })
        setStatus('live')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('sample')
      })
    return () => controller.abort()
  }, [])

  const value = useMemo(() => {
    const byId = new Map(catalog.products.map((product) => [product.id, product]))
    return {
      ...catalog,
      status,
      productById: (id) => byId.get(id) ?? null,
      categoryBySlug: (slug) => findCategoryBySlug(catalog.categories, slug),
    }
  }, [catalog, status])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const value = useContext(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider')
  return value
}
```

`storefront/src/context/StoreContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { cartLines, cartReducer, cartTotals } from '../../../shared/cart.js'
import { useCatalog } from './CatalogContext.jsx'

const StoreContext = createContext(null)
const CART_KEY = 'vitalight.cart'
const SAVED_KEY = 'vitalight.saved'

function load(key, fallback, isValid) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return isValid(value) ? value : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); the app still works in memory.
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export function StoreProvider({ children }) {
  const { products } = useCatalog()
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => load(CART_KEY, {}, isPlainObject))
  const [saved, setSaved] = useState(() => load(SAVED_KEY, [], Array.isArray))
  const [cartOpen, setCartOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const timer = useRef(null)

  useEffect(() => save(CART_KEY, cart), [cart])
  useEffect(() => save(SAVED_KEY, saved), [saved])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const value = useMemo(() => {
    const lines = cartLines(cart, products)
    const notify = (message) => {
      setNotice(message)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setNotice(''), 3000)
    }
    return {
      cart,
      lines,
      totals: cartTotals(lines),
      saved,
      cartOpen,
      orderOpen,
      notice,
      notify,
      add: (id, quantity = 1) => { dispatch({ type: 'add', id, quantity }); notify('Added to your basket') },
      setQty: (id, quantity) => dispatch({ type: 'set', id, quantity }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clearCart: () => dispatch({ type: 'clear' }),
      isSaved: (id) => saved.includes(id),
      toggleSaved: (id) => {
        setSaved((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
        notify(saved.includes(id) ? 'Removed from saved items' : 'Saved for later')
      },
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      openOrder: () => { setCartOpen(false); setOrderOpen(true) },
      closeOrder: () => setOrderOpen(false),
    }
  }, [cart, products, saved, cartOpen, orderOpen, notice])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
```

- [ ] **Step 5: Write the brand CSS**

`storefront/src/styles/tokens.css`:
```css
:root {
  --white: #ffffff;
  --surface: #f6f8fb;
  --line: #e6eaf0;
  --navy: #0b2a50;
  --navy-deep: #092344;
  --navy-soft: #4a5d78;
  --pink: #fd3f92;
  --pink-dark: #d9226f;
  --pink-tint: #fff0f6;
  --radius: 14px;
  --radius-sm: 10px;
  --shadow: 0 8px 28px rgba(11, 42, 80, 0.08);
  --shadow-sm: 0 2px 10px rgba(11, 42, 80, 0.06);
  --font-head: 'Manrope', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --container: 1200px;
  --gutter: clamp(16px, 4vw, 32px);
}
```

`storefront/src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--white);
  color: var(--navy);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4 { font-family: var(--font-head); color: var(--navy); line-height: 1.15; margin: 0; }
p { margin: 0; }
a { color: inherit; text-decoration: none; }
img, svg { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 3px solid var(--pink); outline-offset: 2px; }
::selection { background: var(--pink-tint); }
.container { width: min(var(--container), 100% - 2 * var(--gutter)); margin-inline: auto; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.eyebrow { font: 800 12px/1 var(--font-head); letter-spacing: 0.16em; text-transform: uppercase; color: var(--pink-dark); }
.section { padding-block: clamp(36px, 6vw, 72px); }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.section-head h2 { font-size: clamp(24px, 3vw, 34px); }
.text-link { font-weight: 700; color: var(--navy); border-bottom: 2px solid var(--pink); padding-bottom: 2px; }
.text-link:hover { color: var(--pink-dark); }
```

`storefront/src/styles/components.css`:
```css
/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 22px; border-radius: 999px; border: 2px solid transparent; font-weight: 800; transition: transform .15s, box-shadow .15s, background .15s; }
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: var(--pink); color: var(--navy-deep); }
.btn-primary:hover { box-shadow: 0 8px 20px rgba(253, 63, 146, .35); }
.btn-primary:disabled { background: var(--line); color: var(--navy-soft); cursor: not-allowed; transform: none; box-shadow: none; }
.btn-navy { background: var(--navy); color: var(--white); }
.btn-navy:hover { background: var(--navy-deep); }
.btn-outline { background: transparent; border-color: var(--navy); color: var(--navy); }
.btn-outline:hover { background: var(--navy); color: var(--white); }
.btn-block { width: 100%; }
.icon-btn { position: relative; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--white); display: inline-grid; place-items: center; }
.icon-btn:hover { border-color: var(--pink); color: var(--pink-dark); }
.count-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: var(--pink); color: var(--navy-deep); font: 800 11px/20px var(--font-head); text-align: center; }

/* Header */
.announcement { background: var(--navy); color: var(--white); text-align: center; font-size: 13px; padding: 8px var(--gutter); }
.announcement a { color: #ffb3d4; font-weight: 700; margin-left: 8px; }
.site-header { position: sticky; top: 0; z-index: 30; background: rgba(255, 255, 255, .97); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.header-main { display: flex; align-items: center; gap: 20px; min-height: 76px; }
.brand { display: inline-flex; align-items: center; gap: 10px; flex: none; }
.brand img { width: 52px; height: 52px; object-fit: contain; }
.brand-name { display: grid; font: 800 17px/1 var(--font-head); letter-spacing: .12em; }
.brand-name small { margin-top: 5px; font: 700 9px/1 var(--font-body); letter-spacing: .34em; color: var(--navy-soft); }
.search { position: relative; flex: 1; max-width: 560px; margin-inline: auto; }
.search input { width: 100%; height: 46px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); padding: 0 18px 0 46px; }
.search input:focus { border-color: var(--navy); background: var(--white); outline: none; }
.search .search-icon { position: absolute; left: 16px; top: 13px; color: var(--navy-soft); }
.suggestions { position: absolute; top: 52px; left: 0; right: 0; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); list-style: none; margin: 0; padding: 6px; z-index: 40; }
.suggestions a { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm); }
.suggestions a:hover { background: var(--surface); }
.header-actions { display: flex; align-items: center; gap: 10px; flex: none; }
.menu-toggle { display: none; }
.category-nav { border-top: 1px solid var(--line); }
.category-nav-inner { display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.category-nav-inner::-webkit-scrollbar { display: none; }
.all-categories { flex: none; background: var(--navy); color: var(--white); border: 0; height: 40px; margin: 6px 10px 6px 0; padding: 0 16px; border-radius: 999px; font-weight: 800; }
.category-nav a { flex: none; padding: 12px 10px; font-size: 14px; font-weight: 600; color: var(--navy-soft); border-bottom: 3px solid transparent; }
.category-nav a:hover, .category-nav a.active { color: var(--navy); border-bottom-color: var(--pink); }
.mega { border-top: 1px solid var(--line); background: var(--white); box-shadow: var(--shadow); }
.mega-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding-block: 20px; }
.mega-item { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: var(--radius); }
.mega-item:hover { background: var(--surface); }
.mega-glyph { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--surface); font-size: 20px; }
.mega-item:hover .mega-glyph { background: var(--pink-tint); color: var(--pink-dark); }
.mega-item strong { display: block; font-size: 14px; }
.mega-item small { color: var(--navy-soft); }

/* Product card */
.product-art { aspect-ratio: 1; border-radius: var(--radius); overflow: hidden; display: grid; place-items: center; }
.product-art svg { width: 82%; height: 82%; }
.product-art.has-photo { background: var(--white); border: 1px solid var(--line); }
.product-art img { width: 100%; height: 100%; object-fit: contain; }
.product-card { position: relative; display: flex; flex-direction: column; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; transition: box-shadow .2s, transform .2s; }
.product-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
.card-media { position: relative; }
.badges { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.badge { padding: 4px 9px; border-radius: 999px; font: 800 11px/1.2 var(--font-head); letter-spacing: .04em; }
.badge-sale { background: var(--pink); color: var(--navy-deep); }
.badge-rx { background: var(--navy); color: var(--white); }
.badge-tag { background: var(--white); color: var(--navy); border: 1px solid var(--line); }
.save-btn { position: absolute; top: 8px; right: 8px; width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--white); box-shadow: var(--shadow-sm); display: grid; place-items: center; }
.save-btn.is-saved { color: var(--pink-dark); }
.save-btn.is-saved svg { fill: currentColor; }
.out-of-stock { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255, 255, 255, .7); border-radius: var(--radius); font-weight: 800; }
.card-body { display: flex; flex-direction: column; gap: 4px; padding: 12px 4px 4px; flex: 1; }
.card-brand { font-size: 12px; font-weight: 700; color: var(--navy-soft); text-transform: uppercase; letter-spacing: .06em; }
.card-title { font-size: 15px; font-weight: 800; }
.card-title:hover { color: var(--pink-dark); }
.card-detail { font-size: 13px; color: var(--navy-soft); }
.card-bottom { margin-top: auto; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; }
.price { font: 800 17px var(--font-head); }
.price del { margin-left: 6px; font: 500 13px var(--font-body); color: var(--navy-soft); }
.add-btn { width: 42px; height: 42px; border-radius: 50%; border: 0; background: var(--navy); color: var(--white); display: grid; place-items: center; }
.add-btn:hover:not(:disabled) { background: var(--pink); color: var(--navy-deep); }
.add-btn:disabled { background: var(--line); color: var(--navy-soft); cursor: not-allowed; }
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 18px; }

/* Rails */
.rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(210px, 230px); gap: 18px; overflow-x: auto; padding-bottom: 12px; scroll-snap-type: x proximity; }
.rail > * { scroll-snap-align: start; }

/* Drawer / modal */
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(9, 35, 68, .5); display: flex; justify-content: flex-end; }
.overlay.center { justify-content: center; align-items: center; padding: 16px; }
.drawer { width: min(440px, 100%); height: 100%; background: var(--white); display: flex; flex-direction: column; }
.modal { width: min(520px, 100%); max-height: 100%; overflow: auto; background: var(--white); border-radius: var(--radius); padding: 24px; }
.drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--line); }
.cart-items { flex: 1; overflow: auto; padding: 16px 24px; display: grid; gap: 16px; align-content: start; }
.cart-item { display: grid; grid-template-columns: 72px 1fr auto; gap: 14px; align-items: center; }
.qty { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; margin-top: 6px; }
.qty button { width: 32px; height: 32px; border: 0; background: none; border-radius: 50%; }
.qty span { min-width: 26px; text-align: center; font-weight: 700; }
.cart-summary { padding: 20px 24px; border-top: 1px solid var(--line); display: grid; gap: 12px; }
.row { display: flex; justify-content: space-between; align-items: center; }
.notice { background: var(--pink-tint); border: 1px solid #ffc4de; border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; }
.form { display: grid; gap: 14px; margin-top: 16px; }
.form label { display: grid; gap: 6px; font-weight: 700; font-size: 14px; }
.form input, .form textarea { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; }
.form input:focus, .form textarea:focus { border-color: var(--navy); outline: none; }
.form-error { color: var(--pink-dark); font-weight: 700; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 80; background: var(--navy); color: var(--white); padding: 12px 20px; border-radius: 999px; box-shadow: var(--shadow); }

/* Footer */
.site-footer { background: var(--navy-deep); color: #c9d3e3; margin-top: 40px; }
.footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 32px; padding-block: 48px; }
.site-footer h3 { color: var(--white); font-size: 15px; margin-bottom: 14px; }
.site-footer a { display: block; padding: 4px 0; }
.site-footer a:hover { color: #ffb3d4; }
.footer-bottom { border-top: 1px solid rgba(255, 255, 255, .12); padding-block: 18px; font-size: 13px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }

@media (max-width: 900px) {
  .mega-grid { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .header-main { gap: 10px; }
  .search { order: 5; flex-basis: 100%; max-width: none; margin: 0 0 12px; }
  .header-main { flex-wrap: wrap; padding-top: 10px; min-height: 0; }
  .header-actions { margin-left: auto; }
  .menu-toggle { display: inline-grid; }
  .all-categories { display: none; }
}
@media (max-width: 520px) {
  .brand-name { display: none; }
  .mega-grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
}
```

`storefront/src/styles/pages.css` is created in Tasks 7–9 (create it now as an empty file with a comment):
```css
/* Page styles: home (Task 7), category + search (Task 8), product (Task 9). */
```

- [ ] **Step 6: Write `Header`, `Footer`, `Toast`, `Layout`**

`storefront/src/components/Icon.jsx`:
```jsx
const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  cart: <><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  heart: <path d="M20.8 8.8c0 5.1-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.8A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.7Z" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  check: <path d="m5 12 4 4L19 6" />,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="17.5" cy="18" r="1.5" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2" /><path d="M3 13h4v7H5a2 2 0 0 1-2-2zM21 13h-4v7h2a2 2 0 0 0 2-2z" /></>,
}

export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
```

`storefront/src/components/Header.jsx`:
```jsx
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../../shared/assets/logo.png'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { categorySlug, filterProducts } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import Icon from './Icon.jsx'

export default function Header() {
  const { categories, products } = useCatalog()
  const { totals, saved, openCart } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => { setMenuOpen(false); setFocused(false) }, [location.pathname, location.search])
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { setMenuOpen(false); setFocused(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const suggestions = useMemo(
    () => (query.trim().length >= 2 ? filterProducts(products, { query }).slice(0, 5) : []),
    [products, query],
  )

  function submit(event) {
    event.preventDefault()
    const value = query.trim()
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`)
  }

  return (
    <>
      <div className="announcement">Your health, our priority. Order online and our pharmacist confirms every request.</div>
      <header className="site-header">
        <div className="container header-main">
          <button className="icon-btn menu-toggle" type="button" aria-label={menuOpen ? 'Close categories' : 'Open categories'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <Link className="brand" to="/" aria-label="Vitalight Pharmacy home">
            <img src={logo} alt="" />
            <span className="brand-name">VITALIGHT<small>PHARMACY</small></span>
          </Link>
          <form className="search" role="search" onSubmit={submit}>
            <span className="search-icon"><Icon name="search" size={18} /></span>
            <input
              aria-label="Search products"
              placeholder="Search medicines, vitamins, skin care…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            />
            {focused && suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map((product) => (
                  <li key={product.id}>
                    <Link to={`/product/${product.id}`}><span>{product.name}</span><strong>{formatPrice(product.price)}</strong></Link>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <div className="header-actions">
            <Link className="icon-btn" to="/saved" aria-label={`Saved items, ${saved.length}`}>
              <Icon name="heart" />{saved.length > 0 && <span className="count-badge">{saved.length}</span>}
            </Link>
            <button className="icon-btn" type="button" aria-label={`Open basket, ${totals.count} items`} onClick={openCart}>
              <Icon name="cart" /><span className="count-badge">{totals.count}</span>
            </button>
          </div>
        </div>
        <nav className="category-nav" aria-label="Categories">
          <div className="container category-nav-inner">
            <button className="all-categories" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="menu" size={16} /> All categories
            </button>
            {categories.map((category) => (
              <NavLink key={category.name} to={`/category/${categorySlug(category.name)}`} className={({ isActive }) => (isActive ? 'active' : '')}>
                {category.name}
              </NavLink>
            ))}
          </div>
        </nav>
        {menuOpen && (
          <div className="mega" role="region" aria-label="All categories">
            <div className="container mega-grid">
              {categories.map((category) => (
                <Link key={category.name} className="mega-item" to={`/category/${categorySlug(category.name)}`}>
                  <span className="mega-glyph" aria-hidden="true">{category.icon}</span>
                  <span><strong>{category.name}</strong><small>{category.description}</small></span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  )
}
```

`storefront/src/components/Footer.jsx`:
```jsx
import { Link } from 'react-router-dom'
import logo from '../../../shared/assets/logo.png'
import { contact } from '../config.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { categorySlug } from '../../../shared/catalogTools.js'

export default function Footer() {
  const { categories } = useCatalog()
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" to="/"><img src={logo} alt="" /><span className="brand-name" style={{ color: '#fff' }}>VITALIGHT<small style={{ color: '#9fb0c8' }}>PHARMACY</small></span></Link>
          <p style={{ marginTop: 14 }}>Your health, our priority. A little more care in every day.</p>
        </div>
        <div>
          <h3>Shop</h3>
          {categories.slice(0, 6).map((category) => (
            <Link key={category.name} to={`/category/${categorySlug(category.name)}`}>{category.name}</Link>
          ))}
        </div>
        <div>
          <h3>Help</h3>
          <Link to="/search">Browse all products</Link>
          <Link to="/saved">Saved items</Link>
          </div>
        <div>
          <h3>Talk to us</h3>
          {contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}
          {contact.whatsapp && <a href={`https://wa.me/${contact.whatsapp}`}>WhatsApp</a>}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Vitalight Pharmacy</span>
        <span>Always follow the advice of your healthcare professional.</span>
      </div>
    </footer>
  )
}
```

`storefront/src/components/Toast.jsx`:
```jsx
import { useStore } from '../context/StoreContext.jsx'

export default function Toast() {
  const { notice } = useStore()
  if (!notice) return null
  return <div className="toast" role="status">{notice}</div>
}
```

- [ ] **Step 7: Write `NotFoundPage`, `Layout`, `App`, `main`**

`storefront/src/pages/NotFoundPage.jsx`:
```jsx
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="container section" style={{ textAlign: 'center' }}>
      <p className="eyebrow">404</p>
      <h1 style={{ margin: '12px 0' }}>We couldn’t find that page</h1>
      <p style={{ marginBottom: 24 }}>The product or category may have moved.</p>
      <Link className="btn btn-primary" to="/">Back to the shop</Link>
    </section>
  )
}
```

`storefront/src/components/Layout.jsx` (CartDrawer and OrderModal are created in Task 10; create the two stub files in Step 8 so this compiles now):
```jsx
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import Toast from './Toast.jsx'
import CartDrawer from './CartDrawer.jsx'
import OrderModal from './OrderModal.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'

export default function Layout({ children }) {
  const { status } = useCatalog()
  return (
    <>
      <Header />
      {status === 'sample' && (
        <div className="container" style={{ paddingTop: 12 }}>
          <p className="notice">Showing our sample catalogue. Live stock is not available right now.</p>
        </div>
      )}
      <main>{children}</main>
      <Footer />
      <CartDrawer />
      <OrderModal />
      <Toast />
    </>
  )
}
```

`storefront/src/App.jsx` (replace; page imports are added as tasks 7–9 create them; at this task only `NotFoundPage` and a temporary home placeholder exist):
```jsx
import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import Layout from './components/Layout.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <StoreProvider>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<p className="container section">Home</p>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </StoreProvider>
      </CatalogProvider>
    </BrowserRouter>
  )
}
```

`storefront/src/main.jsx`:
```jsx
import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'

const Admin = lazy(() => import('./admin/Admin.jsx'))
const isAdmin = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Suspense fallback={null}><Admin /></Suspense> : <App />}
  </React.StrictMode>,
)
```

- [ ] **Step 8: Create temporary stubs**

`storefront/src/components/CartDrawer.jsx`:
```jsx
export default function CartDrawer() {
  return null
}
```
`storefront/src/components/OrderModal.jsx`:
```jsx
export default function OrderModal() {
  return null
}
```

- [ ] **Step 9: Delete the old stylesheet**

```bash
git rm storefront/src/styles.css
```

- [ ] **Step 10: Run tests and build**

Run: `npx vitest run storefront && npm run build`
Expected: tests PASS; build succeeds.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: brand system, providers and storefront layout shell"
```

---

### Task 7: ProductCard, ProductGrid, ProductRail and Home page

**Files:**
- Create: `storefront/src/components/{ProductCard,ProductGrid,ProductRail,CategoryChips,PrescriptionBand}.jsx`, `storefront/src/pages/HomePage.jsx`
- Modify: `storefront/src/App.jsx` (route), `storefront/src/styles/pages.css`
- Test: `storefront/src/components/ProductCard.test.jsx`

**Interfaces:**
- Consumes: `useStore`, `useCatalog`, `ProductArt`, `formatPrice`, `discountPercent`, `isInStock`.
- Produces:
  - `<ProductCard product />` (uses `useStore` internally; renders Rx / sale badges, out-of-stock state, save + add buttons)
  - `<ProductGrid products emptyText? />`
  - `<ProductRail title eyebrow? products to? />` (returns `null` for empty `products`)
  - `<CategoryChips />`
  - `<PrescriptionBand />`

- [ ] **Step 1: Write failing test**

`storefront/src/components/ProductCard.test.jsx`:
```jsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import ProductCard from './ProductCard.jsx'

const base = {
  id: 'paracetamol-500mg', name: 'Paracetamol 500 mg Tablets', brand: 'Vitalight', category: 'Medicines & pain relief',
  detail: '24 tablets', price: 1200, oldPrice: null, tag: '', art: 'strip', color: 'mint', image_url: null, stock: 10, rx_required: false,
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup(product) {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><ProductCard product={product} /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

describe('ProductCard', () => {
  it('shows name, brand, price and links to the product page', () => {
    setup(base)
    expect(screen.getByText('Paracetamol 500 mg Tablets').closest('a').getAttribute('href')).toBe('/product/paracetamol-500mg')
    expect(screen.getByText('Vitalight')).toBeTruthy()
    expect(screen.getByText('₦1,200')).toBeTruthy()
  })
  it('shows a discount badge and the old price when on sale', () => {
    setup({ ...base, oldPrice: 1600 })
    expect(screen.getByText('-25%')).toBeTruthy()
    expect(screen.getByText('₦1,600')).toBeTruthy()
  })
  it('shows an Rx badge for prescription products', () => {
    setup({ ...base, rx_required: true })
    expect(screen.getByText('Rx')).toBeTruthy()
  })
  it('disables add-to-basket when out of stock', () => {
    setup({ ...base, stock: 0 })
    expect(screen.getByLabelText(/Add Paracetamol 500 mg Tablets to basket/).disabled).toBe(true)
    expect(screen.getByText('Out of stock')).toBeTruthy()
  })
  it('adds to the basket', () => {
    setup(base)
    fireEvent.click(screen.getByLabelText(/Add Paracetamol 500 mg Tablets to basket/))
    expect(JSON.parse(localStorage.getItem('vitalight.cart'))).toEqual({ 'paracetamol-500mg': 1 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run storefront/src/components`
Expected: FAIL (ProductCard missing).

- [ ] **Step 3: Implement components**

`storefront/src/components/ProductCard.jsx`:
```jsx
import { Link } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { discountPercent, isInStock } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

export default function ProductCard({ product }) {
  const { add, toggleSaved, isSaved } = useStore()
  const discount = discountPercent(product)
  const inStock = isInStock(product)
  const saved = isSaved(product.id)

  return (
    <article className="product-card">
      <div className="card-media">
        <Link to={`/product/${product.id}`} aria-label={product.name} tabIndex={-1}>
          <ProductArt type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
        </Link>
        <div className="badges">
          {discount > 0 && <span className="badge badge-sale">-{discount}%</span>}
          {product.rx_required && <span className="badge badge-rx">Rx</span>}
          {product.tag && discount === 0 && !product.rx_required && <span className="badge badge-tag">{product.tag}</span>}
        </div>
        <button className={`save-btn ${saved ? 'is-saved' : ''}`} type="button" aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from saved items` : `Save ${product.name}`} onClick={() => toggleSaved(product.id)}>
          <Icon name="heart" size={18} />
        </button>
        {!inStock && <div className="out-of-stock">Out of stock</div>}
      </div>
      <div className="card-body">
        {product.brand && <span className="card-brand">{product.brand}</span>}
        <h3 className="card-title"><Link to={`/product/${product.id}`}>{product.name}</Link></h3>
        <p className="card-detail">{product.detail}</p>
        <div className="card-bottom">
          <span className="price">{formatPrice(product.price)}{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</span>
          <button className="add-btn" type="button" disabled={!inStock} aria-label={`Add ${product.name} to basket`} onClick={() => add(product.id)}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
    </article>
  )
}
```

`storefront/src/components/ProductGrid.jsx`:
```jsx
import ProductCard from './ProductCard.jsx'

export default function ProductGrid({ products, emptyText = 'No products found.' }) {
  if (!products.length) return <p className="notice">{emptyText}</p>
  return (
    <div className="product-grid">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  )
}
```

`storefront/src/components/ProductRail.jsx`:
```jsx
import { Link } from 'react-router-dom'
import ProductCard from './ProductCard.jsx'
import Icon from './Icon.jsx'

export default function ProductRail({ eyebrow, title, products, to }) {
  if (!products.length) return null
  return (
    <section className="container section">
      <div className="section-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {to && <Link className="text-link" to={to}>See all <Icon name="arrow" size={14} /></Link>}
      </div>
      <div className="rail">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  )
}
```

`storefront/src/components/CategoryChips.jsx`:
```jsx
import { Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import { categorySlug } from '../../../shared/catalogTools.js'

export default function CategoryChips() {
  const { categories } = useCatalog()
  return (
    <section className="container section" aria-labelledby="chips-title">
      <div className="section-head">
        <div><p className="eyebrow">Shop by category</p><h2 id="chips-title">Find what you need</h2></div>
      </div>
      <div className="chips">
        {categories.map((category) => (
          <Link key={category.name} className="chip" to={`/category/${categorySlug(category.name)}`}>
            <span className="chip-circle" aria-hidden="true">{category.icon}</span>
            <span className="chip-label">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

`storefront/src/components/PrescriptionBand.jsx`:
```jsx
import { contact } from '../config.js'
import Icon from './Icon.jsx'

export default function PrescriptionBand() {
  return (
    <section className="container section">
      <div className="rx-band">
        <div>
          <p className="eyebrow" style={{ color: '#ffb3d4' }}>Prescription medicines</p>
          <h2>Have a prescription?</h2>
          <p>Contact our pharmacist and we will confirm availability and prepare your order. Prescription items are always verified before dispatch.</p>
        </div>
        <div className="rx-actions">
          {contact.phone && <a className="btn btn-primary" href={`tel:${contact.phone}`}>Call the pharmacy</a>}
          {contact.whatsapp && <a className="btn btn-outline" style={{ color: '#fff', borderColor: '#fff' }} href={`https://wa.me/${contact.whatsapp}`}>WhatsApp us</a>}
          {!contact.phone && !contact.whatsapp && <a className="btn btn-primary" href={`mailto:${contact.email}`}>Email the pharmacy <Icon name="arrow" size={16} /></a>}
        </div>
      </div>
    </section>
  )
}
```

`storefront/src/pages/HomePage.jsx`:
```jsx
import { Link } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { discountPercent, isInStock, sortProducts } from '../../../shared/catalogTools.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import CategoryChips from '../components/CategoryChips.jsx'
import PrescriptionBand from '../components/PrescriptionBand.jsx'
import ProductRail from '../components/ProductRail.jsx'
import Icon from '../components/Icon.jsx'

const concerns = [
  { title: 'Immunity & vitamins', text: 'Everyday nutrition support', to: '/category/vitamins-and-supplements' },
  { title: 'Skin & sun care', text: 'Cleanse, protect, soothe', to: '/category/skin-care-and-dermatology' },
  { title: 'Mum & baby', text: 'Gentle care for little ones', to: '/category/mother-and-baby' },
  { title: 'Heart & diabetes', text: 'Monitor and manage at home', to: '/category/diabetes-and-heart-care' },
]

export default function HomePage() {
  const { products } = useCatalog()
  const available = products.filter(isInStock)
  const deals = sortProducts(available.filter((p) => discountPercent(p) > 0), 'discount').slice(0, 10)
  const bestsellers = sortProducts(available.filter((p) => p.featured), 'featured').slice(0, 10)
  const fresh = available.filter((p) => /new|just in/i.test(p.tag || ''))
  const arrivals = (fresh.length ? fresh : available.slice(-10)).slice(0, 10)

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Your neighbourhood pharmacy</p>
            <h1>Care that feels <span>lighter.</span></h1>
            <p className="hero-lede">Trusted medicines, wellness essentials and friendly pharmacist support, ordered online and delivered to you.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/search">Shop all products <Icon name="arrow" size={16} /></Link>
              <Link className="btn btn-outline" to="/category/vitamins-and-supplements">Vitamins</Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-circle" />
            <ProductArt className="hero-tile tile-1" type="vitamin" color="lavender" />
            <ProductArt className="hero-tile tile-2" type="tube" color="peach" />
            <ProductArt className="hero-tile tile-3" type="firstaid" color="blue" />
          </div>
        </div>
      </section>

      <section className="container trust-strip" aria-label="Why Vitalight">
        <div><Icon name="shield" /><span><strong>Quality you can trust</strong><small>Carefully chosen products</small></span></div>
        <div><Icon name="headset" /><span><strong>Pharmacist confirmed</strong><small>Every order is checked</small></span></div>
        <div><Icon name="truck" /><span><strong>Delivered to you</strong><small>Order from anywhere</small></span></div>
      </section>

      <CategoryChips />
      <ProductRail eyebrow="Great value" title="Today’s deals" products={deals} to="/search?sale=1" />
      <PrescriptionBand />
      <ProductRail eyebrow="Customer favourites" title="Bestsellers" products={bestsellers} to="/search" />

      <section className="container section">
        <div className="section-head"><div><p className="eyebrow">Shop by concern</p><h2>What are you looking for?</h2></div></div>
        <div className="concerns">
          {concerns.map((item) => (
            <Link key={item.title} className="concern" to={item.to}>
              <strong>{item.title}</strong><span>{item.text}</span><Icon name="arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow="Just in" title="New arrivals" products={arrivals} to="/search" />
    </>
  )
}
```

- [ ] **Step 4: Append home styles to `storefront/src/styles/pages.css`**

```css
/* Home */
.hero { background: linear-gradient(180deg, var(--surface), var(--white)); }
.hero-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 32px; align-items: center; padding-block: clamp(32px, 6vw, 72px); }
.hero h1 { font-size: clamp(38px, 6vw, 68px); margin: 14px 0 16px; letter-spacing: -0.02em; }
.hero h1 span { color: var(--pink); }
.hero-lede { font-size: 18px; color: var(--navy-soft); max-width: 46ch; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
.hero-art { position: relative; min-height: 340px; }
.hero-circle { position: absolute; inset: 6% 8%; border-radius: 50%; background: var(--pink-tint); }
.hero-tile { position: absolute; width: 38%; box-shadow: var(--shadow); border: 4px solid var(--white); }
.tile-1 { left: 6%; top: 10%; }
.tile-2 { right: 8%; top: 4%; }
.tile-3 { left: 30%; bottom: 2%; width: 42%; }
.trust-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding-block: 8px 0; }
.trust-strip > div { display: flex; gap: 12px; align-items: center; padding: 16px; border: 1px solid var(--line); border-radius: var(--radius); }
.trust-strip strong { display: block; font-size: 15px; }
.trust-strip small { color: var(--navy-soft); }
.chips { display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px 12px; }
.chip { display: grid; justify-items: center; gap: 10px; text-align: center; }
.chip-circle { width: 76px; height: 76px; border-radius: 50%; border: 1px solid var(--line); background: var(--white); display: grid; place-items: center; font-size: 28px; color: var(--navy); box-shadow: var(--shadow-sm); transition: all .2s; }
.chip:hover .chip-circle { border-color: var(--pink); color: var(--pink-dark); background: var(--pink-tint); transform: translateY(-3px); }
.chip-label { font-size: 13px; font-weight: 700; line-height: 1.25; }
.rx-band { display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; align-items: center; background: var(--navy); color: var(--white); border-radius: calc(var(--radius) + 6px); padding: clamp(24px, 4vw, 44px); }
.rx-band h2 { color: var(--white); margin: 8px 0; font-size: clamp(24px, 3vw, 34px); }
.rx-band p:not(.eyebrow) { color: #c9d3e3; max-width: 58ch; }
.rx-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end; }
.concerns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.concern { display: grid; gap: 6px; padding: 22px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); transition: all .2s; }
.concern span { color: var(--navy-soft); font-size: 14px; }
.concern svg { color: var(--pink-dark); margin-top: 6px; }
.concern:hover { border-color: var(--pink); background: var(--white); box-shadow: var(--shadow); }

@media (max-width: 900px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-art { min-height: 280px; }
  .chips { grid-template-columns: repeat(3, 1fr); }
  .concerns { grid-template-columns: repeat(2, 1fr); }
  .rx-band { grid-template-columns: 1fr; }
  .rx-actions { justify-content: flex-start; }
}
@media (max-width: 520px) {
  .trust-strip { grid-template-columns: 1fr; }
  .chips { grid-template-columns: repeat(2, 1fr); }
  .concerns { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Wire the route in `App.jsx`**

Add `import HomePage from './pages/HomePage.jsx'` and replace the placeholder route with `<Route path="/" element={<HomePage />} />`.

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run storefront && npm run build`
Expected: PASS and build OK.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: product cards, rails and home page (layout B)"
```

---

### Task 8: Category, search and saved pages

**Files:**
- Create: `storefront/src/pages/{CategoryPage,SearchPage,SavedPage}.jsx`, `storefront/src/components/{CatalogBrowser,Pagination}.jsx`
- Modify: `storefront/src/App.jsx`, `storefront/src/styles/pages.css`
- Test: `storefront/src/components/CatalogBrowser.test.jsx`

**Interfaces:**
- Consumes: `filterProducts`, `sortProducts`, `paginate`, `brandsOf`, `ProductGrid`.
- Produces:
  - `<CatalogBrowser products initialFilters? title eyebrow? />`: sidebar filters (in stock, on sale, min/max price, brands), sort select, paginated grid (12/page). `initialFilters` may contain `onSaleOnly`.
  - `<Pagination page pages onChange />`.

- [ ] **Step 1: Write failing test**

`storefront/src/components/CatalogBrowser.test.jsx`:
```jsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import CatalogBrowser from './CatalogBrowser.jsx'

const mk = (i, extra = {}) => ({
  id: `p${i}`, name: `Product ${String(i).padStart(2, '0')}`, brand: i % 2 ? 'Alpha' : 'Beta', category: 'C',
  detail: '', price: 1000 + i * 100, oldPrice: null, tag: '', art: 'vitamin', color: 'mint', stock: 5, rx_required: false, ...extra,
})
const products = Array.from({ length: 30 }, (_, i) => mk(i + 1, i === 0 ? { oldPrice: 5000 } : {}))

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup(props = {}) {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><CatalogBrowser title="Test" products={products} {...props} /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

describe('CatalogBrowser', () => {
  it('paginates 12 per page and shows a result count', () => {
    setup()
    expect(screen.getByText('30 products')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('article')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getAllByRole('article')).toHaveLength(6)
  })
  it('filters to on-sale items', () => {
    setup()
    fireEvent.click(screen.getByLabelText('On sale'))
    expect(screen.getByText('1 product')).toBeTruthy()
  })
  it('filters by brand', () => {
    setup()
    fireEvent.click(screen.getByLabelText('Alpha'))
    expect(screen.getByText('15 products')).toBeTruthy()
  })
  it('sorts by price high to low', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'price-desc' } })
    const first = within(screen.getAllByRole('article')[0]).getByRole('heading')
    expect(first.textContent).toBe('Product 30')
  })
  it('shows an empty message when nothing matches', () => {
    setup({ products: [] })
    expect(screen.getByText(/No products match/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run storefront/src/components/CatalogBrowser.test.jsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`storefront/src/components/Pagination.jsx`:
```jsx
export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-outline" type="button" disabled={page <= 1} aria-label="Previous page" onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-outline" type="button" disabled={page >= pages} aria-label="Next page" onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  )
}
```

`storefront/src/components/CatalogBrowser.jsx`:
```jsx
import { useEffect, useMemo, useState } from 'react'
import { brandsOf, filterProducts, paginate, sortProducts } from '../../../shared/catalogTools.js'
import ProductGrid from './ProductGrid.jsx'
import Pagination from './Pagination.jsx'

const PER_PAGE = 12

export default function CatalogBrowser({ eyebrow, title, products, initialFilters = {} }) {
  const [inStockOnly, setInStockOnly] = useState(Boolean(initialFilters.inStockOnly))
  const [onSaleOnly, setOnSaleOnly] = useState(Boolean(initialFilters.onSaleOnly))
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [brands, setBrands] = useState([])
  const [sort, setSort] = useState('featured')
  const [page, setPage] = useState(1)

  const allBrands = useMemo(() => brandsOf(products), [products])

  const filtered = useMemo(() => sortProducts(filterProducts(products, {
    inStockOnly,
    onSaleOnly,
    minPrice: minPrice === '' ? undefined : Number(minPrice),
    maxPrice: maxPrice === '' ? undefined : Number(maxPrice),
    brands,
  }), sort), [products, inStockOnly, onSaleOnly, minPrice, maxPrice, brands, sort])

  useEffect(() => setPage(1), [inStockOnly, onSaleOnly, minPrice, maxPrice, brands, sort, products])

  const view = paginate(filtered, page, PER_PAGE)

  function toggleBrand(brand) {
    setBrands((current) => (current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]))
  }

  return (
    <section className="container section browser">
      <div className="section-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="page-title">{title}</h1>
        </div>
        <label className="sort">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="discount">Biggest discount</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>
      <div className="browser-layout">
        <aside className="filters" aria-label="Filters">
          <fieldset>
            <legend>Availability</legend>
            <label className="check"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} /> In stock</label>
            <label className="check"><input type="checkbox" checked={onSaleOnly} onChange={(event) => setOnSaleOnly(event.target.checked)} /> On sale</label>
          </fieldset>
          <fieldset>
            <legend>Price (₦)</legend>
            <div className="price-inputs">
              <input type="number" min="0" inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
              <input type="number" min="0" inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
            </div>
          </fieldset>
          {allBrands.length > 1 && (
            <fieldset>
              <legend>Brand</legend>
              {allBrands.map((brand) => (
                <label className="check" key={brand}><input type="checkbox" checked={brands.includes(brand)} onChange={() => toggleBrand(brand)} /> {brand}</label>
              ))}
            </fieldset>
          )}
        </aside>
        <div>
          <p className="result-count">{view.total} {view.total === 1 ? 'product' : 'products'}</p>
          <ProductGrid products={view.items} emptyText="No products match these filters. Try clearing a filter or searching for something else." />
          <Pagination page={view.page} pages={view.pages} onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      </div>
    </section>
  )
}
```

`storefront/src/pages/CategoryPage.jsx`:
```jsx
import { useParams, Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import CatalogBrowser from '../components/CatalogBrowser.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function CategoryPage() {
  const { slug } = useParams()
  const { products, categoryBySlug } = useCatalog()
  const category = categoryBySlug(slug)
  if (!category) return <NotFoundPage />
  const items = products.filter((product) => product.category === category.name)
  return (
    <>
      <div className="container breadcrumb"><Link to="/">Home</Link> / <span>{category.name}</span></div>
      <CatalogBrowser key={category.name} eyebrow={category.description} title={category.name} products={items} />
    </>
  )
}
```

`storefront/src/pages/SearchPage.jsx`:
```jsx
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filterProducts } from '../../../shared/catalogTools.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import CatalogBrowser from '../components/CatalogBrowser.jsx'

export default function SearchPage() {
  const { products } = useCatalog()
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const sale = params.get('sale') === '1'
  const items = useMemo(() => filterProducts(products, { query }), [products, query])
  return (
    <CatalogBrowser
      key={`${query}|${sale}`}
      eyebrow={query ? 'Search results' : 'Everything we stock'}
      title={query ? `Results for “${query}”` : sale ? 'Deals and offers' : 'All products'}
      products={items}
      initialFilters={{ onSaleOnly: sale }}
    />
  )
}
```

`storefront/src/pages/SavedPage.jsx`:
```jsx
import { Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import ProductGrid from '../components/ProductGrid.jsx'

export default function SavedPage() {
  const { products } = useCatalog()
  const { saved } = useStore()
  const items = products.filter((product) => saved.includes(product.id))
  return (
    <section className="container section">
      <div className="section-head"><div><p className="eyebrow">Your list</p><h1 className="page-title">Saved items</h1></div></div>
      {items.length
        ? <ProductGrid products={items} />
        : <p className="notice">You haven’t saved anything yet. Tap the heart on a product to keep it here. <Link className="text-link" to="/search">Browse products</Link></p>}
    </section>
  )
}
```

- [ ] **Step 4: Add routes and styles**

In `App.jsx` add imports and routes (above the `*` route):
```jsx
import CategoryPage from './pages/CategoryPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import SavedPage from './pages/SavedPage.jsx'
...
<Route path="/category/:slug" element={<CategoryPage />} />
<Route path="/search" element={<SearchPage />} />
<Route path="/saved" element={<SavedPage />} />
```

Append to `pages.css`:
```css
/* Category / search */
.breadcrumb { padding-top: 20px; font-size: 14px; color: var(--navy-soft); }
.breadcrumb a:hover { color: var(--pink-dark); }
.page-title { font-size: clamp(26px, 3.4vw, 38px); }
.browser { padding-top: 20px; }
.browser-layout { display: grid; grid-template-columns: 240px 1fr; gap: 28px; align-items: start; }
.filters { display: grid; gap: 18px; position: sticky; top: 150px; }
.filters fieldset { border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; margin: 0; display: grid; gap: 8px; }
.filters legend { font: 800 13px var(--font-head); padding: 0 6px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.check input { accent-color: var(--pink); width: 16px; height: 16px; }
.price-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.price-inputs input { width: 100%; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px 10px; }
.sort { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
.sort select { border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; background: var(--white); }
.result-count { margin-bottom: 14px; color: var(--navy-soft); font-weight: 700; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 28px; }
@media (max-width: 900px) {
  .browser-layout { grid-template-columns: 1fr; }
  .filters { position: static; grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run storefront && npm run build`
Expected: PASS and build OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: category, search and saved pages with filters, sorting and pagination"
```

---

### Task 9: Product detail page

**Files:**
- Create: `storefront/src/pages/ProductPage.jsx`, `storefront/src/pages/ProductPage.test.jsx`
- Modify: `storefront/src/App.jsx`, `storefront/src/styles/pages.css`

**Interfaces:**
- Consumes: `useCatalog().productById`, `relatedProducts`, `ProductRail`, `ProductArt`, `useStore().add`.
- Produces: route `/product/:id`. Shows an Rx notice when `rx_required`, stock state, quantity selector (1–99), and related products.

- [ ] **Step 1: Write failing test**

`storefront/src/pages/ProductPage.test.jsx`:
```jsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider } from '../context/StoreContext.jsx'
import ProductPage from './ProductPage.jsx'

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

function setup(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CatalogProvider><StoreProvider>
        <Routes><Route path="/product/:id" element={<ProductPage />} /><Route path="*" element={<p>other</p>} /></Routes>
      </StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

describe('ProductPage', () => {
  it('renders a product with price and stock state', () => {
    setup('/product/paracetamol-500mg')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Paracetamol 500 mg Tablets')
    expect(document.querySelector('.price.big').textContent).toBe('₦1,200')
    expect(screen.getByText(/In stock|left in stock/)).toBeTruthy()
  })
  it('shows the prescription notice for Rx products', () => {
    setup('/product/amoxicillin-500mg')
    expect(screen.getByText(/pharmacist will verify your prescription/i)).toBeTruthy()
  })
  it('adds the chosen quantity to the basket', () => {
    setup('/product/paracetamol-500mg')
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByRole('button', { name: /Add to basket/ }))
    expect(JSON.parse(localStorage.getItem('vitalight.cart'))).toEqual({ 'paracetamol-500mg': 3 })
  })
  it('shows not-found for an unknown product', () => {
    setup('/product/does-not-exist')
    expect(screen.getByText(/couldn’t find that page/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run storefront/src/pages`
Expected: FAIL (ProductPage missing).

- [ ] **Step 3: Implement `storefront/src/pages/ProductPage.jsx`**

```jsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { MAX_QUANTITY } from '../../../shared/cart.js'
import { categorySlug, discountPercent, isInStock, relatedProducts } from '../../../shared/catalogTools.js'
import { formatPrice } from '../../../shared/money.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import ProductRail from '../components/ProductRail.jsx'
import Icon from '../components/Icon.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function ProductPage() {
  const { id } = useParams()
  const { products, productById } = useCatalog()
  const { add, toggleSaved, isSaved } = useStore()
  const [quantity, setQuantity] = useState(1)
  const product = productById(id)
  if (!product) return <NotFoundPage />

  const discount = discountPercent(product)
  const inStock = isInStock(product)
  const maxQuantity = Math.min(MAX_QUANTITY, Number(product.stock) || 1)
  const saved = isSaved(product.id)
  const related = relatedProducts(products, product)

  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/category/${categorySlug(product.category)}`}>{product.category}</Link> / <span>{product.name}</span>
      </div>
      <section className="container product-detail">
        <ProductArt className="detail-art" type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
        <div className="detail-info">
          {product.brand && <p className="card-brand">{product.brand}</p>}
          <h1>{product.name}</h1>
          <p className="detail-text">{product.detail}</p>
          <p className="detail-price">
            <span className="price big">{formatPrice(product.price)}</span>
            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
            {discount > 0 && <span className="badge badge-sale">-{discount}%</span>}
          </p>
          <p className={`stock ${inStock ? 'in' : 'out'}`}>
            {!inStock ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left in stock` : 'In stock'}
          </p>
          {product.rx_required && (
            <p className="notice">
              <strong>Prescription medicine.</strong> Our pharmacist will verify your prescription before this item is dispatched.
            </p>
          )}
          <div className="detail-actions">
            <div className="qty" role="group" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Icon name="minus" size={14} /></button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={quantity >= maxQuantity} onClick={() => setQuantity(quantity + 1)}><Icon name="plus" size={14} /></button>
            </div>
            <button className="btn btn-primary" type="button" disabled={!inStock} onClick={() => add(product.id, quantity)}>Add to basket</button>
            <button className={`icon-btn ${saved ? 'is-saved' : ''}`} type="button" aria-pressed={saved} aria-label={saved ? 'Remove from saved items' : 'Save for later'} onClick={() => toggleSaved(product.id)}>
              <Icon name="heart" />
            </button>
          </div>
          <p className="detail-note">Orders are requests. Our team confirms availability, final price and delivery with you before fulfilment.</p>
        </div>
      </section>
      <ProductRail eyebrow="You may also like" title="Related products" products={related} to={`/category/${categorySlug(product.category)}`} />
    </>
  )
}
```

- [ ] **Step 4: Add route and styles**

In `App.jsx` add `import ProductPage from './pages/ProductPage.jsx'` and `<Route path="/product/:id" element={<ProductPage />} />`.

Append to `pages.css`:
```css
/* Product detail */
.product-detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(20px, 4vw, 56px); padding-block: 24px 8px; align-items: start; }
.detail-art { border: 1px solid var(--line); }
.detail-info { display: grid; gap: 14px; }
.detail-info h1 { font-size: clamp(26px, 3.4vw, 40px); }
.detail-text { color: var(--navy-soft); font-size: 17px; }
.detail-price { display: flex; align-items: center; gap: 12px; }
.price.big { font-size: 30px; }
.detail-price del { color: var(--navy-soft); }
.stock { font-weight: 700; }
.stock.in { color: #0c7a4d; }
.stock.out { color: var(--pink-dark); }
.detail-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.detail-actions .qty { margin-top: 0; }
.icon-btn.is-saved { color: var(--pink-dark); border-color: var(--pink); }
.icon-btn.is-saved svg { fill: currentColor; }
.detail-note { font-size: 13px; color: var(--navy-soft); }
@media (max-width: 760px) { .product-detail { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run storefront && npm run build`
Expected: PASS and build OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: product detail page with Rx notice, quantity and related products"
```

---

### Task 10: Cart drawer and order-request checkout

**Files:**
- Replace: `storefront/src/components/CartDrawer.jsx`, `storefront/src/components/OrderModal.jsx`
- Test: `storefront/src/components/Checkout.test.jsx`

**Interfaces:**
- Consumes: `useStore()` (`lines`, `totals`, `cartOpen`, `orderOpen`, `setQty`, `remove`, `openOrder`, `closeCart`, `closeOrder`, `clearCart`, `notify`), `submitOrder` from `api.js`.
- Produces: behaviour parity with the existing order-request flow (POST `/api/orders` with `{name, phone, address, items:[{productId, quantity}]}`), plus an Rx notice when `totals.hasRx`.

- [ ] **Step 1: Write failing test**

`storefront/src/components/Checkout.test.jsx`:
```jsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogProvider } from '../context/CatalogContext.jsx'
import { StoreProvider, useStore } from '../context/StoreContext.jsx'
import CartDrawer from './CartDrawer.jsx'
import OrderModal from './OrderModal.jsx'

function Controls() {
  const { add, openCart, totals } = useStore()
  return (
    <>
      <button onClick={() => add('paracetamol-500mg', 2)}>add-otc</button>
      <button onClick={() => add('amoxicillin-500mg')}>add-rx</button>
      <button onClick={openCart}>open</button>
      <span data-testid="count">{totals.count}</span>
    </>
  )
}

function setup() {
  return render(
    <MemoryRouter>
      <CatalogProvider><StoreProvider><Controls /><CartDrawer /><OrderModal /></StoreProvider></CatalogProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('cart drawer', () => {
  it('shows an empty state', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText(/Your basket is empty/)).toBeTruthy()
  })
  it('lists items, shows total and updates quantity', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText('Paracetamol 500 mg Tablets')).toBeTruthy()
    expect(screen.getAllByText('₦2,400').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByLabelText('Remove one Paracetamol 500 mg Tablets'))
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
  it('warns about prescription items', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    setup()
    fireEvent.click(screen.getByText('add-rx'))
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByText(/prescription medicines/i)).toBeTruthy()
  })
})

describe('order request', () => {
  it('submits the order and clears the basket', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog') throw new Error('offline')
      return { ok: true, json: async () => ({ orderId: 'abc' }) }
    })
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Okafor' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+234 800 000 0000' } })
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: '12 Example Street' } })
    fireEvent.click(screen.getByRole('button', { name: /Send order request/ }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    const orderCall = fetchMock.mock.calls.find(([url]) => url === '/api/orders')
    expect(JSON.parse(orderCall[1].body)).toEqual({
      name: 'Ada Okafor', phone: '+234 800 000 0000', address: '12 Example Street',
      items: [{ productId: 'paracetamol-500mg', quantity: 2 }],
    })
  })
  it('shows the server error and keeps the basket', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === '/api/catalog') throw new Error('offline')
      return { ok: false, json: async () => ({ error: 'Out of stock somewhere' }) }
    })
    setup()
    fireEvent.click(screen.getByText('add-otc'))
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByRole('button', { name: /Request this order/ }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Okafor' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+234 800 000 0000' } })
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: '12 Example Street' } })
    fireEvent.click(screen.getByRole('button', { name: /Send order request/ }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Out of stock somewhere/))
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run storefront/src/components/Checkout.test.jsx`
Expected: FAIL (stubs render nothing).

- [ ] **Step 3: Implement `CartDrawer.jsx`**

```jsx
import { Link } from 'react-router-dom'
import ProductArt from '../../../shared/art/ProductArt.jsx'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

export default function CartDrawer() {
  const { cartOpen, closeCart, lines, totals, setQty, openOrder } = useStore()
  if (!cartOpen) return null

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCart() }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-head">
          <h2 id="cart-title">Your basket ({totals.count})</h2>
          <button className="icon-btn" type="button" aria-label="Close basket" onClick={closeCart}><Icon name="close" /></button>
        </div>
        {lines.length === 0 ? (
          <div className="cart-items">
            <p>Your basket is empty.</p>
            <Link className="btn btn-primary" to="/search" onClick={closeCart}>Browse products</Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {lines.map(({ product, quantity, lineTotal }) => (
                <div className="cart-item" key={product.id}>
                  <ProductArt type={product.art} color={product.color} imageUrl={product.image_url} name={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <div className="qty" role="group" aria-label={`Quantity of ${product.name}`}>
                      <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => setQty(product.id, quantity - 1)}><Icon name="minus" size={14} /></button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Add one ${product.name}`} onClick={() => setQty(product.id, quantity + 1)}><Icon name="plus" size={14} /></button>
                    </div>
                  </div>
                  <strong>{formatPrice(lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              {totals.hasRx && (
                <p className="notice">Your basket includes prescription medicines. Our pharmacist will verify your prescription before dispatch.</p>
              )}
              <div className="row"><span>Estimated total</span><strong className="price">{formatPrice(totals.total)}</strong></div>
              <p style={{ fontSize: 13 }}>Our team confirms availability, final price and delivery before fulfilment.</p>
              <button className="btn btn-primary btn-block" type="button" onClick={openOrder}>Request this order <Icon name="arrow" size={16} /></button>
              <button className="btn btn-outline btn-block" type="button" onClick={closeCart}>Keep browsing</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
```

- [ ] **Step 4: Implement `OrderModal.jsx`**

```jsx
import { useState } from 'react'
import { submitOrder } from '../api.js'
import { formatPrice } from '../../../shared/money.js'
import { useStore } from '../context/StoreContext.jsx'
import Icon from './Icon.jsx'

const emptyForm = { name: '', phone: '', address: '' }

export default function OrderModal() {
  const { orderOpen, closeOrder, lines, totals, clearCart, notify } = useStore()
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  if (!orderOpen) return null

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await submitOrder({
        ...form,
        items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      })
      clearCart()
      setForm(emptyForm)
      closeOrder()
      notify('Order request received. We’ll be in touch soon.')
    } catch (submitError) {
      setError(submitError.message || 'We could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overlay center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOrder() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
        <div className="row">
          <h2 id="order-title">Request your order</h2>
          <button className="icon-btn" type="button" aria-label="Close order form" onClick={closeOrder}><Icon name="close" /></button>
        </div>
        <p style={{ marginTop: 8 }}>Share your details and our team will confirm availability, delivery and pricing.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>Your name<input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ada Okafor" /></label>
          <label>Phone number<input autoComplete="tel" required type="tel" pattern="[+0-9\(\)\- ]{7,25}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+234 800 000 0000" /></label>
          <label>Delivery address<textarea autoComplete="street-address" required minLength={5} maxLength={500} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Where should we deliver?" /></label>
          <div className="row"><span>{totals.count} {totals.count === 1 ? 'item' : 'items'} · estimated total</span><strong className="price">{formatPrice(totals.total)}</strong></div>
          {totals.hasRx && <p className="notice">Prescription medicines are verified by our pharmacist before dispatch.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting || lines.length === 0}>{submitting ? 'Sending your request…' : 'Send order request'}</button>
          <p style={{ fontSize: 13 }}>This is an order request, not a payment. We’ll contact you to confirm your order.</p>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run && npm run build`
Expected: all test files PASS; build OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cart drawer and order-request checkout with prescription notice"
```

---

### Task 11: Visual verification, docs and spec sync

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-13-foundation-storefront-design.md`

**Interfaces:** none.

- [ ] **Step 1: Start the app**

Run (background): `npm run dev`
Expected: Vite prints a local URL (default `http://localhost:5173`); API on 3001.

- [ ] **Step 2: Visual checks with Playwright MCP**

Using the Playwright browser tools, for each of `/`, `/category/vitamins-and-supplements`, `/product/amoxicillin-500mg`, `/search?q=cream`:
1. Take a full-page screenshot at 1280×900 and at 375×812.
2. Confirm: no horizontal scroll at 375 px; header search usable; category row scrolls; the product grid has no overlapping text; pink appears only on CTAs / badges / active states; the Rx badge and notice show on the amoxicillin page.
3. Open the basket drawer, add an item, open the request form, and confirm it renders without layout breakage.
4. Check the browser console for errors (`browser_console_messages`).

Fix any defects found (CSS-only fixes go in `storefront/src/styles/*.css`) and re-run `npx vitest run`.

- [ ] **Step 3: Confirm the legacy admin still loads**

Navigate to `/admin`. Expected: the existing sign-in screen renders (it will show a configuration message if Supabase env vars are blank). Confirm no console errors.

- [ ] **Step 4: Run the production build and serve**

```bash
npm run build && node server/index.js
```
Open `http://localhost:3001/` and `http://localhost:3001/category/mother-and-baby` (deep link). Expected: both render (SPA fallback works). Stop the server.

- [ ] **Step 5: Update `README.md`**

Replace the "Run locally" steps 4 and 5 and add a project-layout section:
```md
4. In the Supabase SQL editor run, in order: `supabase/schema.sql`, `supabase/migrations/001_catalogue_v2.sql`, `supabase/migrations/002_seed_catalogue.sql`. This creates the tables, the 12 categories and 120 sample products, and the `product-images` bucket. The catalogue is sample content: review names, prices and stock before taking orders.
5. Optional: set `VITE_PHARMACY_PHONE`, `VITE_PHARMACY_WHATSAPP` and `VITE_PHARMACY_EMAIL` in `.env` so the storefront shows contact buttons.

## Project layout

- `storefront/` – customer site (Vite + React, `npm run dev`)
- `shared/` – logic, catalogue data and product artwork used by both client and server
- `server/` – Express API (`createApp` in `server/app.js`)
- `supabase/` – schema and migrations (`002_seed_catalogue.sql` is generated by `node scripts/generate-seed.js` from `shared/catalog.js`)

Run `npm test` for the unit tests. Production: `npm run build` then `npm start`.
```
Also change every `src/catalog.js` mention to `shared/catalog.js`.

- [ ] **Step 6: Sync the spec with the plan's refinements**

In `docs/superpowers/specs/2026-10-13-foundation-storefront-design.md`, replace the Schema migration bullet list under "## 4. Catalogue and data" so it reads:

```md
**Schema migration (`001_catalogue_v2.sql`, plus generated `002_seed_catalogue.sql`):**

- `products`: add `brand text`, `rx_required boolean default false`, `sort_order int default 0`. Widen the `art` check constraint to exactly 14 keys: the existing 7 plus `tube`, `sachet`, `strip`, `dropper`, `spray`, `jar`, `box`.
- No `slug` columns: product `id` is already a URL-safe unique slug; category slugs are derived from the name at runtime.
- Legacy categories are renamed in place (`Medicines`, `Personal care`, `First aid`, `Health devices`) so existing products follow via `ON UPDATE CASCADE`.
- The seed SQL is generated from `shared/catalog.js` and is idempotent (`on conflict do nothing` for products).
```
Also in the repo structure block of the spec, no change is needed beyond this.

- [ ] **Step 7: Final full test run**

Run: `npx vitest run && npm run build`
Expected: all tests PASS; build OK.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: update README and spec; visual verification fixes"
```
