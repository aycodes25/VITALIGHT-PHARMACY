# AI Import (admin) — design

Date: 2026-11-02

## Goal
Let an admin paste a shop/category URL of another website, scan it for products (rule-based, no LLM), review each product in a queue, edit/approve/reject, and have approved products saved as normal Vitalight products (admin list + storefront).

## Decisions
- **Extraction:** rule-based scraping only (no API cost). Order: Shopify `/products.json` → WooCommerce Store API → JSON-LD `Product` → OpenGraph/meta. If none yield products, report "no readable product data" — never guess.
- **Scope:** one pasted URL, following pagination/product links up to ~20 pages or 200 products; polite delay between requests. No whole-site crawl.
- **Images:** downloaded and re-hosted in our Supabase storage at approval time (type + size checked). Review screen previews the source URLs.
- **Categories:** reviewer picks per product from a dropdown pre-filled by best-guess matching to existing categories; can add a new category from the screen. Source categories are never auto-created.
- **Currency:** assume naira (₦); show parsed currency so the reviewer can correct.
- **Use note:** only import from sites the owner has permission to use (suppliers/distributors); manual approval is the safeguard.

## UI (admin → "AI Import")
- URL box + **Scan**, progress line, summary bar: total found / approved / rejected / pending.
- Card per product: photos, name, price, old price, description, category dropdown, stock, tag — all editable. Buttons: Approve (disabled while required fields missing), Reject, Edit. Bulk: Approve all valid, Reject all.
- Possible-duplicate flag when a product name already exists.

## Backend
- New `backend/routes/import.js`, admin-only (reuse existing admin auth).
- Fetch server-side with timeout, response-size cap, and SSRF protection (block private/loopback/link-local addresses, re-check after redirects, http/https only).
- Scanning is stepwise: one page per request, driven by the admin page, to stay within Vercel function time limits.
- Extractors are separate small modules, each: `(html|json, url) -> products[]`.

## Data
New migration:
- `import_batches` (id, source_url, status, created_at)
- `import_items` (id, batch_id, data jsonb, image_urls, status pending/approved/rejected, product_id nullable, created_at)
Admin-only access (RLS enabled, service-role from backend). Queue persists across refresh.

## Approve flow
Takes the reviewer's edited values → downloads images into Supabase storage → inserts product through the same path as the manual add-product form → marks item approved with `product_id`. Product id = slug of name, suffixed on collision; `art`/`color` get defaults required by the schema. Reject only marks rejected.

## Errors
- Image download failure: warn, save product without that image.
- Bad URL, 403/blocked, timeout, no product data: clear message in UI.
- Prices parsed to integer naira.

## Testing
Vitest, matching existing `backend/test` style: each extractor against saved sample HTML/JSON, URL-safety check, price parsing, approve flow with Supabase mocked, duplicate detection.
