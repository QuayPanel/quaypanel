# QuayPanel

Open-source, self-hosted billing panel for modern hosting providers. API-first, plugin-ready, and free to run.

Built with Next.js, PostgreSQL, Prisma, Better Auth, Redis, BullMQ, Stripe, PayPal, React Email, and Pino.

## Features (Phase 1 + Phase 2 + backlog waves)

- Admin and client portals with light/dark theme toggle
- Public storefront with categories, products, cart, and navbar catalog
- Products, plans (multi-currency fields), orders, invoices, payments, coupons, and tax
- Services lifecycle + recurring renewals with auto-charge and cron statistics
- Manual mark-invoice-paid, gateway refunds with client credit, live cron reschedule
- Service upgrades with proration credit / upgrade invoices
- Client self-serve profile editing; store quantity picker; server cart sync API
- Pterodactyl + Proxmox provisioning (Providers admin UI)
- Support tickets, knowledge base (`/docs`), affiliates
- Stripe and PayPal gateways (configurable adapters)
- Themes marketplace registry, FX rates settings, plugin package registry, multi-tenant flag
- Versioned REST API (`/api/v1`) with session or API key auth
- Redis caching, rate limiting, and BullMQ job queues
- React Email + SMTP delivery
- Plugin interfaces for payment gateways and provisioning providers
- Audit logging and webhook idempotency



## Requirements

- Node.js 20+
- Docker (recommended) for PostgreSQL and Redis
- SMTP credentials (optional in development — emails are logged)



## Quick start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit BETTER_AUTH_SECRET (32+ chars), admin credentials, and gateway keys
# If Redis requires a password, set REDIS_PASSWORD or use
# REDIS_URL=redis://:password@localhost:6379

# 3. Start Postgres + Redis
docker compose up -d

# 4. Migrate and seed
npm run db:migrate
npm run db:seed

# 5. Run the app and worker
npm run dev
npm run worker
```

Open [http://localhost:3000](http://localhost:3000).

Default admin (from `.env`):

- Email: `admin@example.com`
- Password: `ChangeMe123!`



## Production

QuayPanel needs an **always-on** host: the Next.js app **and** a long-running BullMQ worker. Vercel (or similar serverless) alone is not enough - renewals, suspensions, and cron jobs run in `npm run worker`.

### 1. Prepare the server

- Node.js 20+
- PostgreSQL 16+ and Redis 7+ (use `docker compose up -d` for those, or managed services)
- A reverse proxy with HTTPS (Caddy, Nginx, Traefik, etc.)



### 2. Configure environment

```bash
cp .env.example .env
```

Set at least:


| Variable                                              | Production value                                       |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `NODE_ENV`                                            | `production`                                           |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` | Your public HTTPS URL (same value)                     |
| `BETTER_AUTH_SECRET`                                  | Long random secret (32+ characters)                    |
| `DATABASE_URL`                                        | Postgres connection string                             |
| `REDIS_URL`                                           | Redis connection string (include password if required) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`                      | Strong credentials (used by seed)                      |
| `SMTP_*`                                              | Real SMTP so invoices and notices send                 |
| `STRIPE_*` / `PAYPAL_*`                               | Live keys when you go live; set `PAYPAL_MODE=live`     |




### 3. Install, migrate, build

```bash
npm ci
npx prisma migrate deploy   # or: npm run db:migrate:deploy
npm run db:seed             # first deploy only — creates admin + defaults
npm run build
```

Do **not** use `npm run db:migrate` in production (`migrate dev` is for local development).

### 4. Run the app and worker

Both processes must stay running:

```bash
npm run start    # Next.js on port 3000 (or set PORT)
npm run worker   # renewals, suspensions, queued jobs
```

Example with [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start npm --name quaypanel-web -- start
pm2 start npm --name quaypanel-worker -- run worker
pm2 save
pm2 startup
```

Point your reverse proxy at the web process (port `3000` by default). After DNS and TLS are up, open the site, sign in as the seeded admin, and change the password.

### 5. Updates

```bash
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart quaypanel-web quaypanel-worker
```



### Notes

- Keep Postgres and Redis reachable from both the web app and the worker.
- Configure Stripe/PayPal webhook URLs to your public host (`/api/webhooks/stripe`, `/api/webhooks/paypal`).
- Seed only on first install (or when you intentionally want to re-apply seed data).
- If logo/favicon uploads return **413**, raise the reverse-proxy body limit (e.g. Nginx `client_max_body_size 10m;`). Next.js is configured for 10MB uploads.



## Architecture


| Area                           | Path                   |
| ------------------------------ | ---------------------- |
| Domain services                | `src/domains/*`        |
| Payment / provisioning plugins | `src/plugins/*`        |
| API routes                     | `app/api/v1/*`         |
| Storefront                     | `app/(store)/store/*`  |
| Webhooks                       | `app/api/webhooks/*`   |
| Worker                         | `worker/index.ts`      |
| Prisma schema                  | `prisma/schema.prisma` |




### Phase 2 notes

- Affiliate tracking cookie: visit `/r/<code>` then convert via store checkout
- Catalog starts empty - create categories, products, plans, and coupons under Admin
- Configure Pterodactyl / Proxmox under Admin → Providers; set product `provisionProvider` accordingly
- Worker schedules renewals (cron time/timezone from settings) and suspends past grace
- Knowledge base: Admin → Knowledge base; public at `/docs`

Business logic lives in domain services. Route handlers and Server Actions call the same services.

### Payment gateways

Gateways implement `PaymentGateway` in `src/plugins/payments/types.ts`. Built-ins:

- `stripe`
- `paypal`

Webhook endpoints:

- `POST /api/webhooks/stripe`
- `POST /api/webhooks/paypal`



### Provisioning

`ProvisioningProvider` is defined for later Pterodactyl/Proxmox/etc. Phase 1 ships a `noop` provider that logs actions.

## API overview

Authenticate with a session cookie (browser) or:

```http
Authorization: Bearer qp_...
```

Examples:

```http
GET /api/v1/clients
POST /api/v1/products
POST /api/v1/orders
GET /api/v1/invoices
POST /api/v1/invoices/:id/pay
GET /api/v1/settings
```

Response envelope:

```json
{ "data": {}, "error": null, "meta": {} }
```



## Scripts


| Script                      | Description                               |
| --------------------------- | ----------------------------------------- |
| `npm run dev`               | Next.js development server                |
| `npm run start`             | Next.js production server (after `build`) |
| `npm run worker`            | BullMQ worker process                     |
| `npm run db:migrate`        | Prisma migrations (development)           |
| `npm run db:migrate:deploy` | Apply migrations (production)             |
| `npm run db:seed`           | Seed admin, settings, gateway configs     |
| `npm run build`             | Generate Prisma client + production build |
| `npm run email:dev`         | Preview React Email templates             |




## License

[AGPL-3.0](./LICENSE)

ApexNode.host may offer paid managed hosting in the future. The software itself remains free to self-host, modify, and contribute to under the AGPL.