# Vitalight Pharmacy

A responsive pharmacy storefront built with React, Vite, and an Express API. Product cards and prices in `src/catalog.js` are starter catalogue content for the storefront; update them to match your actual stock before accepting orders.

## Run locally

1. Install Node.js 20.19+ and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env`. Set the Supabase project URL in `VITE_SUPABASE_URL` and `SUPABASE_URL`, and its publishable/anon key in `VITE_SUPABASE_ANON_KEY`. Set the **server-only** `SUPABASE_SERVICE_ROLE_KEY` and add one or more invited, email-confirmed administrator accounts to the comma-separated `ADMIN_EMAILS` entry.
4. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor. It creates the protected product, category, and order tables, seeds the starter catalogue, and creates the public product-image bucket. Review the sample catalogue and stock values before taking orders.
5. In Supabase Authentication, invite your admin email address and confirm that it matches an entry in `ADMIN_EMAILS`.
6. Run `npm run dev` and open the Vite URL printed in the terminal. The admin area is at `/admin`.

The Express API runs on port 3001 in development. `npm run build` creates the production storefront, and `npm start` serves the built app and API together. Vite's development server exposes only the `/api` proxy to Express. Set `PORT` to change the server port.

## Supabase and order requests

The `/admin` workspace includes a summary dashboard, searchable product catalogue, image uploads, pricing and stock controls, featured/visibility controls, category management, and customer order review and status updates. Admin API routes verify Supabase Auth access tokens on the server and check the verified account email against `ADMIN_EMAILS`; they are not protected only by hiding the page. Create/invite admin accounts through Supabase Auth—there is no public admin signup.

The service-role key is used only by the Express server and must never be added to client-side code or committed. Product, category, and order tables have row-level security enabled with no public policies; privileged database operations go through the verified server API. Product photos are restricted to JPEG, PNG, and WebP up to 5 MB and uploaded to the public `product-images` bucket. Do not upload private or patient information.

Until Supabase and an admin account are configured, the storefront remains browsable using starter catalogue data, while the admin login and order submissions explain which setup is missing. Starter catalogue content and prices in `src/catalog.js` and `supabase/schema.sql` are examples; replace them with verified stock and pharmacy prices before taking orders. Orders are requests only—not payments. The pharmacy should confirm availability, final price, delivery, and any prescription requirements directly with the customer before fulfilment.
