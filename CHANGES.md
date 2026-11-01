# Update notes (design + concept changes)

## How to apply (local + GitHub + server)
1. Copy every file from this zip over your project folder (same paths). Do not delete your `.env` / `uploads`.
2. `npm install` (no new packages) -> `npm run dev` to test.
3. `git add . && git commit && git push`. Commit `server/assets/fonts/*.ttf` too (Tamil PDF needs them).
4. Server: pull + `npm start`. New tables/columns are created AUTOMATICALLY when the server starts
   (migrations master/003 and tenant/003, also `npm run migrate`).
5. Optional .env (see .env.example): `WHATSAPP_PROVIDER` (log | cloud | twilio | webhook) + its keys, `APP_URL`.
6. On Railway mount a Volume on `/uploads` or logos / banners / payment screenshots are lost on redeploy.

## What changed
- Super admin: new **Super admins** page (create / edit / password / block / delete), **Settings** page
  (platform name, logo, icon, accent colour, WhatsApp provider status + test message). Letter is shown when no logo/icon.
  Whole super admin area (login, sidebar, pages) uses the "current" design.
- Company logo / icon / cover image (uploaded only in super admin) are used everywhere: navbar, admin sidebar,
  login pages, browser tab icon (icon, else logo), bill print, price-list PDF. Home banner = Settings banner,
  otherwise the company cover image. Settings banner option is unchanged.
- **Year-end reset** (Admin > Settings, company admin only): full copy of the company database is created as
  `<db>_<year>` (every table verified), then orders / order items / whatsapp log are emptied. Old years are viewable,
  read-only, in **Admin > Old Data** (monthly sales, orders, bill print, Excel). Refuses while Unpaid / Pending orders exist.
  Needs password + typing RESET. Chosen instead of "truncate only" because old data stays viewable and nothing can be lost.
- Price list: Excel/PDF dialog. Admin only: discount % for the whole list, Tamil / English for PDF.
- Quick Buy: search clear (x); changing brand or category clears the search (also on All Products).
- Check Availability visible only to company admin / staff.
- Password boxes everywhere have an eye button (default hidden), including popup password prompts.
- Cart: Clear cart button.
- New upload box (drag & drop, previews) for banner, category, product, payment screenshot, Excel/PDF upload.
- Print bill shows company logo / icon.
- "Current" design refreshed (aurora background, glass cards, floating navbar / sidebar). default and normal untouched.
- WhatsApp (Tamil + English in one message): order placed, payment screenshot received, paid, delivered (track link),
  cancelled, unpaid reminder 12h and 1h before the payment hold ends. Super admin chooses per company
  With / Without WhatsApp, which messages, hold hours and optional auto-cancel (Companies > Edit).
