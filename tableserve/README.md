# TableServe

Multi-tenant restaurant management and QR table ordering. Guests scan the QR code on their table, browse the menu in English or Hindi, and order and pay from their phone browser. No app install or sign-up is needed. Restaurants get a kitchen display, a waiter app, cashier billing, reports and multi-branch administration. The platform operator gets a Super Admin console for companies, plans, subscriptions and support.

> This folder is self-contained. The rest of the repository (the Next.js "GullyScore" app at the repo root) is unrelated and was left untouched.

---

## Quick start

Requirements: **Node.js 22.13 or later**. The app uses Node's built-in `node:sqlite`, so there is no native build step and no external database.

```bash
cd tableserve
npm install
cp .env.example .env        # optional for local use
npm start                   # http://localhost:3000
```

On first start with an empty database the server loads **clearly labelled demo data** (set `SEED_DEMO=false` to skip it). To wipe the data and seed again, run `npm run seed`.

Run the automated verification suite (it uses an in-memory database):

```bash
npm test
```

### Demo data

All demo accounts use the password **`Demo@1234`**. Every demo record is marked `[DEMO]`.

| Who | Email |
|---|---|
| Platform Super Admin | `super@tableserve.demo` |
| Platform Admin (onboarding + support only) | `support@tableserve.demo` |
| **Company A – [DEMO] Spice Garden** (Growth plan, branches Koramangala + Indiranagar) | `owner@`, `manager@`, `kitchen@`, `waiter@`, `cashier@` + `spicegarden.demo` |
| **Company B – [DEMO] Coastal Curry Co.** (Starter plan on trial, branch Bandra) | `owner@`, `manager@`, `kitchen@`, `waiter@`, `cashier@` + `coastalcurry.demo` |

Both companies have a **Table 5**. Their demo QR links are fixed so they are easy to try. Real tables always get random, unguessable tokens.

- Spice Garden · Koramangala · Table 5 → `http://localhost:3000/t/demo-spice-kor-t5`. Guests can start the table themselves.
- Spice Garden · Indiranagar · Table 5 → `http://localhost:3000/t/demo-spice-ind-t5`
- Coastal Curry · Bandra · Table 5 → `http://localhost:3000/t/demo-coastal-ban-t5`. Staff must open the table or approve the guest's phone.

The branch manager, kitchen, waiter and cashier accounts are assigned only to the first branch of their company. The seed also adds about two weeks of paid history so the reports have data.

To try it on a real phone, set `APP_URL` to an address the phone can reach (for example `http://192.168.1.20:3000`) before you print or scan QR codes.

---

## What's included

| Area | Implemented |
|---|---|
| **Roles** | Super Admin, Platform Admin (permission-scoped), Company Owner, Restaurant Admin / Branch Manager, Kitchen, Waiter, Cashier, Customer (no account). Each role has its own navigation and home screen. |
| **Company & branches** | Profile, logo upload, brand colour, description, contact, opening hours. Multiple branches, each with its own menu, tables, staff and settings. Copy a menu between branches. |
| **Staff** | Invite by one-time link with a role and branch access. Edit role, branches and status. Only the owner can manage admins. Admins only manage staff in their own branches. |
| **Settings** | Languages (EN/HI), currency, taxes (any number, e.g. CGST + SGST), service charge, payment methods, and **menu-only** vs **menu-with-ordering** mode. |
| **Tables & QR** | Table number, seats, section and assigned waiter. Unique QR per table, as SVG preview, PNG download and a printable bilingual table-card sheet. The QR stays the same when the menu or prices change; replacing a QR is a separate, audited action. |
| **Table states & sessions** | Available, Occupied, Bill Requested, Cleaning. Staff open and close dining sessions. Each session has a 4-digit table code. Several phones can join one session: by code, by staff approval, or by self-start when the branch allows it. |
| **Digital menu** | Categories, search, filters (veg, non-veg, popular, specials, combos, mild), photos, descriptions, prices, portion size, veg/non-veg/egg/vegan marks, ingredients, allergens, taste and spice level, option groups (Half/Full, Small/Large, add-ons), popular items, specials, combos, Hindi and English text, per-branch availability, and an out-of-stock toggle. Changes reach open phones in real time. |
| **Ordering** | Cart with quantities, options, cooking instructions and an order note. An estimated breakdown of charges is shown before ordering. Guests can place repeat orders, see live status with an ETA, and cancel an order while it is still pending. They can call a waiter, ask for water or request the bill. A receipt is downloadable after payment. Browsing needs no registration. |
| **Kitchen display** | Tablet layout with New, Cooking and Ready columns. Sound alerts. Accept with a prep time (or automatic), reject with a reason, Preparing, Ready. Live timers that turn red when late. Printable KOTs. Quick stock toggles. Managers can pause and resume orders. |
| **Waiter app** | Live floor plan, join-request approvals, service requests, ready-to-serve alerts with sound, mark served, take orders for a table, close the table, and mark it available after cleaning. |
| **Billing** | One bill per dining session, combining all accepted orders. Item totals, discounts (percentage or flat, with a reason and a cashier limit), service charge, configurable taxes, payments, refunds and outstanding balance. Cash, card and UPI recorded by the cashier. UPI reported by the guest waits for cashier confirmation. Online payments use a gateway with verified notifications. Partial payments let the bill be split at the counter. Partial and full refunds keep a history. |
| **Reports** | Daily, weekly and monthly sales, paid revenue (test-mode revenue shown separately), refunds and net, outstanding bills, cancelled orders, best sellers, average bill value, payment-method mix, branch comparison and CSV export. |
| **Platform** | Companies list with usage, onboarding (creates the company and an owner invite link), plan changes, suspend or activate, trial extension, monthly and annual plans with limits on branches, tables and staff (enforced on the server), platform subscription payments and revenue, support tickets, platform-admin permissions and the platform audit log. |
| **Audit log** | Session open/close and force-close, order rejections and cancellations, discounts, payment confirmations and failures, refunds, price changes, settings and payment-settings changes, staff and invitation changes, branch pause and resume, and platform actions. |

---

## Architecture

```
tableserve/
├── server/
│   ├── index.js          entry point (.env loader, auto demo seed, listen)
│   ├── app.js            Express app, config, security headers, CSRF guard, static files
│   ├── db.js             SQLite schema (node:sqlite) + small query/transaction wrapper
│   ├── auth.js           cookie sessions, role → permission map, company/branch scoping helpers
│   ├── services.js       core operations: sessions, orders, transitions, service requests, bills, payment settlement, audit
│   ├── pricing.js        server-side cart pricing & bill computation
│   ├── gateway.js        payment gateways: simulated TEST gateway + Razorpay
│   ├── realtime.js       Server-Sent Events hub (branch / session / menu / join channels)
│   ├── receipt.js        printable HTML receipt
│   ├── seed.js           demo data
│   └── routes/           auth, public (customer), staff (operations), manage (owner/admin), platform, payments/webhooks
├── public/               no-build frontend (Preact + htm via import map)
│   ├── customer.html / js/customer.js   phone-first QR ordering app (EN/HI)
│   ├── app.html / js/app.js + js/pages/ staff, owner and platform dashboards
│   └── css/              design system (warm palette, large touch targets)
└── test/core.test.js     end-to-end API verification (node:test)
```

- **Stack:** Node.js 22, Express 4, SQLite (built-in `node:sqlite`, WAL mode), Server-Sent Events, Preact 10 and htm served as ES modules with no bundler, and `qrcode` for QR generation.
- **Real-time:** each staff screen keeps one SSE connection per branch. Each guest phone subscribes to its branch's menu channel and, once authorised, its own session channel. Clients reconnect on their own and resync their state after a reconnect.
- **Money** is stored as integers in minor units (paise).

### Database structure

| Table | Purpose |
|---|---|
| `users`, `auth_sessions` | Accounts (scrypt password hashes) and hashed login tokens. `platform_role` / `platform_perms` are set for platform staff. |
| `companies` | Tenant: profile, branding, languages, ordering mode, taxes, service charge, payment settings (gateway secrets encrypted), plan, subscription state. |
| `branches` | Per-branch settings: pause flag, self-start sessions, default prep time, cashier discount limit, order and bill sequences. |
| `company_members`, `member_branches`, `invitations` | Role per company and branch access. Invitations store only a hash of the one-time token. |
| `categories`, `menu_items` | Per-branch menu. Option groups are stored as JSON on the item. |
| `tables` | Table number, capacity, section, permanent random `qr_token`, status, current session. |
| `dining_sessions`, `session_devices`, `join_requests`, `code_attempts` | Dining sessions, authorised guest phones (hashed tokens), staff-approval requests, brute-force throttling. |
| `orders`, `order_items` | Orders with a per-session idempotency key. Item rows **snapshot name, options and unit price**. |
| `service_requests` | Waiter, water and bill calls. |
| `bills`, `payments`, `refunds`, `webhook_events` | Restaurant sales: one bill per session, payments (`pending`/`paid`/`failed`/`refunded`), refund history, and deduplicated verified gateway events. |
| `plans`, `subscription_payments`, `support_tickets`, `support_messages` | Platform side. Subscription revenue is **separate** from restaurant sales. |
| `audit_logs` | Who did what, when, from which IP, with details. |

---

## Security & data-isolation model

- **Tenant isolation is enforced on the server.** Every staff and admin request resolves one active membership. Records are then loaded through `auth.scoped()` or `auth.assertBranch()`, which require `company_id` to match and the branch to be among the member's assigned branches. A record from another company returns **404**, so its existence is not revealed. Permission checks (`requirePerm`) use a single role-to-permission map in `server/auth.js`.
- **Guest access:** the QR identifies only the table. To see orders or the bill, or to order or pay, a phone needs a device token bound to the table's **current** open session. Closing the session invalidates every token from that session at once and closes those phones' live streams. Join codes are rate-limited per table and IP.
- **Prices:** every order line is priced from the current menu at submission, after re-checking availability and options. Client-supplied prices are ignored. Items are frozen into `order_items`, so later menu edits never change existing orders or bills. Bills are always recomputed on the server.
- **Duplicate orders:** each submission carries an idempotency key that is reused on retries. The `(session_id, idempotency_key)` uniqueness check runs inside a transaction, and the button is disabled while sending. An order is shown as confirmed only after the server responds.
- **Payments:** a payment becomes `paid` only through `services.settlePayment`. That is reached from (a) a cashier recording or confirming a counter payment, or (b) an HMAC-verified gateway webhook or checkout signature. Guest "I paid by UPI" claims stay `pending` until a cashier confirms, and screenshots are never accepted. A late "failed" event can never downgrade a paid payment. Webhook events are deduplicated.
- **Credentials:** passwords are hashed with scrypt. Login and session tokens are stored only as SHA-256 hashes, in HttpOnly SameSite=Lax cookies (Secure in production). Every cookie-authenticated mutation requires an `X-Requested-With` header (CSRF guard). Restaurant gateway secrets are AES-256-GCM encrypted with `DATA_ENCRYPTION_KEY`, are write-only, and are never sent back to the browser. Logins are rate-limited.

---

## Payments: test mode and going live

Out of the box the online payment option uses the built-in **simulated gateway, labelled TEST MODE** everywhere: on the checkout page, on payment rows and on receipts, and as a separate figure in reports. It behaves like a real provider. The guest is sent to a hosted checkout page, and the result reaches the restaurant only as an HMAC-signed server-to-server webhook, which is verified before anything changes. **No real money moves.** "Pay at counter / cash" works without any setup.

**To accept real online payments (Razorpay):**

1. Each restaurant needs its own KYC-activated Razorpay account. Sales money goes directly to the restaurant, never through TableServe.
2. In TableServe, go to *Company & payments → Payment methods → Online → Razorpay*. Enter the **Key ID** and **Key Secret** (Razorpay Dashboard → Settings → API Keys).
3. In Razorpay Dashboard → Settings → Webhooks, add the webhook URL shown on that screen (`<APP_URL>/api/webhooks/razorpay/<companyId>`). Select the events `payment.captured`, `payment.failed` and `order.paid`, choose a secret, and paste the same secret into **Webhook Secret**.
4. Run the server on a public **HTTPS** `APP_URL` and set a strong `DATA_ENCRYPTION_KEY`.
5. In production set `ALLOW_TEST_PAYMENTS=false` so the simulated gateway is never offered.

`rzp_test_…` keys work for staging. The UI labels them as Razorpay test keys.

**UPI direct:** enter the restaurant's UPI ID. Guests see a UPI QR code and deep link with the exact amount. Each payment still needs cashier confirmation, because UPI-to-VPA transfers give the server no verifiable notification.

---

## Features that need external credentials or extra setup

| Feature | Status / what's needed |
|---|---|
| Live online payments | Each restaurant's own Razorpay keys and webhook secret (see above). The TEST MODE gateway works without them. |
| Invitation emails | **Not sent automatically.** Invitations produce a one-time link for staff to share. Automatic email needs an SMTP or transactional email provider, which could be added in `routes/manage.js` (`POST /invitations`). |
| Platform subscription billing | Super Admin records subscription payments manually, which extends the paid period. Charging restaurants automatically would need a separate platform gateway account. |
| Google Fonts | Loaded from Google if online. System fonts are used otherwise. |
| Horizontal scaling | The SSE hub and rate limiters are in-memory, so run **one** instance. Multiple instances would need a shared pub/sub (e.g. Redis) and a server database (e.g. PostgreSQL). |

## Optional features (after the core workflow)

| Feature | Status |
|---|---|
| Split bills | **Partial:** the cashier can record several partial payments in any mix of methods against one table bill. Per-guest item splitting is not built yet. |
| Dish ratings, loyalty points, inventory, reservations, takeaway, delivery | Not built yet. The schema and service layer were designed to make room for them (e.g. orders already carry `source`, and item stock is per branch). |

---

## Verification

`npm test` runs `test/core.test.js` against a fresh in-memory database with the demo seed. It covers the 8 required checks plus related permission and billing cases:

| # | Requirement | Test |
|---|---|---|
| 1 | Each table QR opens the correct restaurant, branch and table | `1. each Table 5 QR resolves…`: both Table 5 links resolve to their own company, branch and menu; unknown QR returns 404; QR image is generated |
| 2 | Users from one company cannot access another company's records | `2. users from one company…`: Spice owner gets 404 on Coastal tables, orders, menu items, QR, stream and order actions; branch manager gets 403 on an unassigned branch; kitchen and waiter blocked from admin, discount and platform APIs; CSRF guard |
| 3 | Two authorised customers at one table place separate orders into one session | `3 & 4.`: phone A joins by code, phone B by staff approval; both orders share one `session_id` and both phones see both |
| 4 | Repeated submission creates one order | `3 & 4.`: 5 concurrent identical submissions create exactly 1 order, and all responses return it |
| 5 | Kitchen status changes reach customers and waiters | `5 & 6.`: SSE streams for the customer and the waiter receive `accepted → preparing → ready → served` |
| 6 | Bills use server-validated prices and quantities | `5 & 6.`: client-sent prices are ignored; a later menu price change leaves the bill unchanged; tax and service-charge maths checked; cashier discount limit enforced and audited |
| 7 | Closing a session blocks the next customers from its orders | `7.`: closing pushes `session.closed`; old token gets 401 on session, bill and ordering; the next guest's session is empty |
| 8 | Online payment changes only after verified confirmation | `8.`: forged, unsigned and wrong-secret webhooks are rejected; cashier cannot hand-confirm an online payment; the signed webhook marks it paid; replay is idempotent; a late failure does not downgrade it |

Further tests cover the refund permission, reason and audit; forced close needing a manager and a reason; guest UPI staying pending until cashier confirmation; re-validation of stock and options; paused branches; plan limits; suspension; and platform-payment separation.

The UI was also exercised end-to-end in headless Chromium: guest ordering on two phones, kitchen accept, live status on the phone, waiter floor and join approval, cashier discount, TEST MODE online payment and receipt, owner menu edit, QR download, and Super Admin console.

## Configuration reference

See [`.env.example`](.env.example). Key variables: `APP_URL`, `PORT`, `DATABASE_FILE`, `UPLOAD_DIR`, `DATA_ENCRYPTION_KEY` (required in production), `ALLOW_TEST_PAYMENTS`, `TEST_GATEWAY_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY`, `SEED_DEMO`.
