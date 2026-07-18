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

## Architecture

| Area | Path |
|------|------|
| Domain services | `src/domains/*` |
| Payment / provisioning plugins | `src/plugins/*` |
| API routes | `app/api/v1/*` |
| Storefront | `app/(store)/store/*` |
| Webhooks | `app/api/webhooks/*` |
| Worker | `worker/index.ts` |
| Prisma schema | `prisma/schema.prisma` |

### Phase 2 notes

- Affiliate tracking cookie: visit `/r/<code>` then convert via store checkout
- Sample coupon from seed: `WELCOME10` (10% off)
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

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js development server |
| `npm run worker` | BullMQ worker process |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed admin, settings, gateway configs |
| `npm run build` | Generate Prisma client + production build |
| `npm run email:dev` | Preview React Email templates |

## License

[AGPL-3.0](./LICENSE)

ApexNode.host may offer paid managed hosting in the future. The software itself remains free to self-host, modify, and contribute to under the AGPL.
