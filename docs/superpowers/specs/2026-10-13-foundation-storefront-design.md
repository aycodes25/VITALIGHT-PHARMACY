# Vitalight Pharmacy: Foundation and Storefront Redesign (Sub-project 1)

Date: 2026-10-13
Status: Draft for user review

## Context

Vitalight Pharmacy is a React + Vite storefront with an Express API and a Supabase backend. It currently has 7 starter products, 5 categories, a single-file storefront (`src/App.jsx`), and an `/admin` page inside the same app. The owner wants a professional, enticing pharmacy site (inspired by medplusnig.com in structure, but original in design and assets), a much larger catalogue, and a separate admin website that controls everything.

## Overall programme (for context)

| # | Sub-project | Scope |
|---|---|---|
| 1 | **Foundation + storefront redesign (this spec)** | Repo restructure, brand system, storefront rebuild (layout B), ~120-product catalogue, schema migration |
| 2 | Separate admin app | Own Vite app and login; full product/category/order management incl. bulk operations, image upload, CSV import/export |
| 3 | Accounts, checkout, Paystack | Customer auth, saved addresses, order history, payment and webhook verification |
| 4 | Admin power features | Customers/payments views, homepage/content control, store settings, coupons, reports, staff roles, activity log |

This spec covers only sub-project 1. Requirements from the owner that belong to later sub-projects are recorded under "Forward requirements" so this foundation does not block them.

## Goals

1. Restructure the repo so a separate admin app can be added without churn.
2. Establish a brand system: white 60%, deep navy 30%, French fuchsia pink `#fd3f92` 10%.
3. Rebuild the storefront in "Layout B" (modern boutique-wellness): airy white layout, editorial hero with one pink accent word, circular category chips, generous whitespace.
4. Expand the catalogue to about 120 products across 12 categories with consistent branded artwork.
5. Keep the current behaviours: offline fallback catalogue, order-request flow, existing admin API and `/admin` page working until sub-project 2.

## Non-goals

- Customer accounts, payments, coupons (sub-project 3 and 4).
- The new admin UI (sub-project 2). Only the data model and API groundwork needed to support it are in scope here.
- Real product photography. Real photos are uploaded by the admin later.

## 1. Repo structure and architecture

```
VITALIGHT-PHARMACY/
├── storefront/        Vite app (customer site): index.html, src/
├── admin/             Vite app (sub-project 2; the old /admin page stays in storefront until then)
├── server/
│   ├── index.js       app wiring, static serving
│   ├── lib/auth.js    requireAdmin, requireDatabase
│   ├── lib/validate.js
│   └── routes/{public,admin}.js
├── shared/            formatPrice, API client helpers, catalog.js (offline fallback), art/ components
├── supabase/
│   ├── schema.sql
│   └── migrations/001_catalogue_v2.sql
└── package.json       single package; scripts: dev, build, start
```

- Single `package.json` and two Vite roots. Storefront builds to `dist/storefront`; admin will build to `dist/admin`.
- One Express server serves `/api` and the built apps in production. In development, Vite proxies `/api` to port 3001.
- `server/index.js` (about 520 lines) is split into modules with no behaviour change, so sub-project 2 can extend it cleanly.
- The existing `/admin` page keeps working in the storefront until sub-project 2 replaces it, then it is removed.

## 2. Brand system

- CSS variables: `--white #fff`, `--surface #f6f8fb`, `--navy #0b2a50`, `--navy-deep #092344`, `--pink #fd3f92`, `--pink-dark #e82c7d`.
- Usage rule: white for page and card backgrounds; navy for header, hero panels, footer, headings and body text; pink only for CTAs, price/discount badges, active states and small highlights, never large fills.
- Typography: Manrope (headings), DM Sans (body). 12px card radius, soft shadows.
- Accessibility: text on pink uses `--pink-dark` where contrast on small text requires it; interactive elements have visible focus states.

## 3. Storefront pages and components (Layout B)

- **Header:** announcement bar (delivery threshold, pharmacist hours), logo, search with suggestions, wishlist, cart drawer, and a 12-category mega-menu.
- **Home:** editorial hero; circular category chips; "Have a prescription?" band (call or WhatsApp the pharmacy; no file upload yet); deals, new and bestseller rails; wellness-concern tiles; trust strip; footer.
- **Category page:** filters (price range, in stock, on sale, brand), sort, product grid, pagination.
- **Product page:** image or artwork, price and old price, stock state, Rx notice, quantity, related products.
- **Routing:** `react-router`, with URLs like `/category/:slug` and `/product/:id`.
- **Cart:** persisted in localStorage; checkout remains the existing order-request flow until sub-project 3.
- **Prescription-only items:** products flagged `rx_required` show a "pharmacist will confirm prescription" notice and are submitted as order requests that the pharmacy confirms.
- **Responsive:** designed mobile-first, verified at 375px and 1280px widths.

## 4. Catalogue and data

Twelve categories with about 10 products each:

1. Medicines & pain relief
2. Cold, flu & allergy
3. Digestive health
4. Vitamins & supplements
5. Skin care & dermatology
6. Hair, body & personal care
7. Mother & baby
8. Sexual wellness & family planning
9. Diabetes & heart care
10. First aid & wound care
11. Health devices & diagnostics
12. Fitness & nutrition

**Schema migration (`001_catalogue_v2.sql`, plus generated `002_seed_catalogue.sql`):**

- `products`: add `brand text`, `rx_required boolean default false`, `sort_order int default 0`. Widen the `art` check constraint to exactly 14 keys: the existing 7 plus `tube`, `sachet`, `strip`, `dropper`, `spray`, `jar`, `box`.
- No `slug` columns: product `id` is already a URL-safe unique slug; category slugs are derived from the name at runtime.
- Legacy categories are renamed in place (`Medicines`, `Personal care`, `First aid`, `Health devices`) so existing products follow via `ON UPDATE CASCADE`.
- The seed SQL is generated from `shared/catalog.js` and is idempotent (`on conflict do nothing` for products).

**Artwork:** SVG components in `shared/art/` (bottle, box, tube, sachet, blister strip, dropper, spray, device, kit, jar, pump, pouch, diapers, glucometer) tinted per category. Used by both storefront and admin previews. An uploaded `image_url` always takes precedence.

**Content caveat:** all names, prices and descriptions are illustrative sample content using neutral descriptors (form, pack size); no medical claims. The owner must verify them before taking real orders, consistent with the existing README.

## 5. Error handling and testing

- API down or Supabase unconfigured: storefront falls back to the bundled catalogue with a subtle notice (current behaviour retained).
- Order submission errors are surfaced inline with a retry.
- Testing: Vitest for pure logic (cart reducer, price formatting, filters/sorting) and for API route handlers with a mocked Supabase client; Playwright screenshots of home, category and product pages at mobile and desktop widths for visual review.
- Existing admin API behaviour is unchanged and covered by route tests after the split.

## Forward requirements (owner-stated, for sub-project 2)

The admin account must be able to:

- Upload and edit product details, prices and images.
- Edit and re-edit any product at any time.
- Delete a single product, delete all products in a category, and delete all selected products (multi-select bulk delete), with confirmation prompts.
- Bulk-update (price, stock, visibility, category) selected products and import/export CSV.

Foundation implications handled in this sub-project: stable product IDs and slugs, `sort_order`, and an admin API module layout where bulk endpoints (`DELETE /api/admin/products` with an id list, `DELETE /api/admin/categories/:name/products`) can be added without restructuring. Category deletion remains `restrict` (categories with products cannot be deleted unless emptied first), which makes "delete all products in a category" the natural first step.

## Open assumptions (will proceed unless corrected)

- Currency stays Naira (₦); prices stored as integer naira.
- Prescription handling is "pharmacist confirms", with no automated prescription upload until a later sub-project.
