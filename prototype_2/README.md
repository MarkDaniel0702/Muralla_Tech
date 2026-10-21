# Muralla Tech prototype 2 (Electronics only)

A standalone copy of the Muralla Tech storefront rebuilt with plain **HTML5, CSS3 and vanilla JavaScript**: no framework, no build step, no install, no backend. It shows the Electronics category only and includes the buyer, seller and admin flows and a **mock** GCash / Maya payment module. The original app is untouched.

## Run it

* **Double-click `index.html`.** It works straight from disk.
* Or serve the folder with any static server, e.g. `python -m http.server 8000` in this folder, then open http://localhost:8000.

Fonts (Fraunces, Hanken Grotesk) load from Google Fonts; offline, the page falls back to Georgia / Arial.

All data lives in your browser's `localStorage` (keys start with `mf2_`). Use **Reset demo data** in the footer to start over. Each browser profile has its own data; reload to see changes made in another tab.

## Demo accounts (mock only, plain-text passwords in `data/users.json`)

| Role | Email | Password | Notes |
|---|---|---|---|
| Buyer | `buyer@murallatech.test` | `buyer123` | |
| Seller | `seller@murallatech.test` | `seller123` | Rico, owns the phones, tablets, watches (16 listings); has a GCash payout account |
| Seller 2 | `seller2@murallatech.test` | `seller123` | Lena, owns chargers, power banks, speaker, camera, consoles (9 listings); **no payout account** (so you can see the "add a payout account" path). A second seller exists so a cart with two sellers makes two orders |
| Admin | `admin@murallatech.test` | `admin123` | |

The login page can fill these in with one click. Sign Up creates new buyer or seller accounts (admin cannot be self-selected).

## Pages

`index.html` Home (hero search, newest-listings carousel, tabbed Newest devices, How it works) · `pages/browse.html` search, sort, filters (type, price, condition, brand, size, material/color) · `listing.html` details · `sell.html` · `cart.html` · `checkout.html` · `pay.html` (send proof of payment) · `orders.html` (My Orders, Incoming Orders, My Listings, Saved, Notifications, Settings) · `login.html` (log in + sign up) · `admin.html`.

## How each flow works

**Buyer.** Browse and search, view photos, save favorites, add to cart. Checkout: choose *Standard delivery* (₱80 per seller) or *Meet-up* (free), enter details, choose GCash or Maya (standard delivery only), place the order. One order is created per seller. Then on **Pay**: Muralla Tech' own GCash/Maya details and the exact amount are shown; the buyer submits the proof of payment. In **My Orders** the buyer tracks the status and clicks *I received the item* once the seller has handed it over. Orders can be cancelled only before any money is held.

**Seller.** *List an item* with up to 5 photos and required fields (title, brand, condition, size/dimensions, material/color, price, description). The listing waits for admin review. *My Listings* edits price/stock or deletes. *Incoming Orders*: for a paid digital order, hand over the item and click *Mark as handed over*; for a meet-up order, *Confirm order* then *Mark as handed over (completed)*. Each digital order shows the fee and payout breakdown and the payout status. A payout account is added under Settings.

**Admin.** Tabs: *Overview*; *Listings* (approve, reject with a reason, delete); **Payment Confirmation** (approve or reject proofs); *Payouts* (tracking and release); *Payment details* (Muralla Tech' GCash/Maya account name, number, optional QR, on/off); *Activity log*. An admin who lists an item gets "Published" at once. Buyers and sellers who open `admin.html` get "Access denied", signed-out visitors are asked to log in.

## Payment module (mock: no real payments, no real keys)

* **Digital (GCash / Maya):** the buyer pays the platform first. Proof form: sender name (required), reference number (required, unique), amount in PHP (required, must equal the order total), method, optional screenshot (stored in the browser).
* **Meet-up:** payment is arranged between buyer and seller. The platform shows no payment details and takes no proof, no fee and makes no payout; meet-up orders have no payment record at all.
* **Fee:** `platform_fee = item_price × 0.05`, `seller_payout = item_price − platform_fee`, digital payments only. Payout is released only after the order is `completed`.
* **Statuses:** order `awaiting_payment → payment_submitted → payment_confirmed → completed`, plus `payment_rejected` and `cancelled`; payout `not_due → pending_release → released`. Meet-up orders use `pending → confirmed → completed` (and `cancelled`).
* **Validation:** duplicate reference numbers are refused; an amount that differs from the order total is refused; rejecting needs a reason; max 3 proofs per order; every status change and payout is written to the activity log with the actor and the time (also shown as "Status history" on each order).

## Decisions where the brief was silent (change them if wrong)

1. The **delivery fee** is passed on to the seller with the payout (the stored `seller_payout` is exactly item price − fee). The admin payout card shows both.
2. A **rejected proof frees its reference number** so a typo can be corrected; any pending or approved reference is unique across all orders.
3. The buyer can confirm receipt only **after the seller marks the item handed over**; no auto-complete if either never clicks.
4. **No refunds:** once a payment is approved the order cannot be cancelled. Cancelling returns the stock.
5. The **admin approves payments and releases payouts** (the current app has a separate "verifier" role; this prototype has only buyer, seller, admin). An admin cannot review their own order.
6. **Cash on delivery** from the current app is not included, because the brief lists only digital and meet-up payments. Seller KYC and user management were also left out.
7. Editing the price or stock of a published listing is not re-moderated.

## Files

```
index.html, pages/*.html   one HTML file per page (same shell, script list, and a page script)
css/styles.css             design tokens, dark/light theme and components, copied from the current app, plus a few additions at the end
js/theme-init.js           applies the saved theme before first paint
js/store.js                localStorage state and first-run seed
js/ui.js                   safe HTML templating, formatting, toast, theme, header and footer
js/auth.js                 accounts, roles, page guard
js/listings.js             search/filter/sort, create, moderate, saved
js/cart.js                 cart (ids and quantities; prices always read from the live listing)
js/payment.js              orders and the payment module (all rules live here)
js/card.js, js/orderui.js  listing card with hover slideshow; order pieces shared by Orders and Admin
js/pages/*.js              one script per page
data/*.json                listings (25 electronics), users, settings (fee rate, delivery fee, platform accounts)
data/seed.js               generated copy of the JSON for double-click use (see below)
assets/                    logos and the 104 listing photos
tools/                     build_seed.py, test_payment.js, e2e_test.py
```

Browsers block `fetch()` of local files, so `data/seed.js` carries the same data for the double-click case. After editing any `data/*.json`, run `python tools/build_seed.py`, then use **Reset demo data**.

## Photos

Real Wikimedia Commons photos under Creative Commons / public-domain licenses, copied from the current app's demo catalogue. Each listing page has a "Photo credits" list; the full list is in `assets/photos/CREDITS.md`. The photos show the model, not the exact unit, and every description says it is a demo listing.

## Tests

* `node tools/test_payment.js`: runs the real payment code against a fake localStorage and checks the fee math and every status path, role rule and the log (no browser, no install).
* `python tools/e2e_test.py`: browser test of every role and payment path, hover slideshow, carousel, filters, theme, keyboard, phone width and file:// mode. Needs `pip install playwright pillow` and `playwright install chromium`, and the folder served on port 8765 (`python -m http.server 8765`).

## What a real backend would still have to provide

Real accounts (hashed passwords, email verification, sessions), server-side enforcement of every rule above (today they are enforced in the browser, so anyone can edit `localStorage`), shared data between users and devices, real GCash/Maya receiving and payouts and bank reconciliation, private storage for receipt screenshots, notifications by email or push, and any BSP registration questions for holding buyers' money.
