# Writing plugins

Plugins are prebuilt drop-ins. QuayPanel does **not** compile TypeScript at install time.

## Layout

```
plugins/my-plugin/
  addon.json
  dist/index.js      # compiled entry (CJS or ESM)
  assets/            # optional → /addons/plugins/my-plugin/...
  README.md
```

## `addon.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "type": "plugin",
  "entry": "dist/index.js",
  "provides": ["payment.gateway"],
  "hooks": ["order.paid"],
  "configSchema": {
    "apiKey": { "type": "string", "title": "API key" }
  }
}
```

`id` must match the folder name.

## Entry

```js
// dist/index.js
function register(api) {
  api.registerPaymentGateway({
    id: "acme-pay",
    name: "Acme Pay",
    async createCheckout(input) { /* ... */ },
    async handleWebhook(req, rawBody) { /* ... */ },
    async refund(externalId, amount) { /* ... */ },
  });

  api.on("order.paid", async (payload) => {
    console.log("paid", payload.orderId);
  });

  const cfg = api.getConfig();
}

module.exports = { register };
```

### Plugin API

| Method | Purpose |
|--------|---------|
| `registerPaymentGateway(gateway)` | Same contract as core Stripe/PayPal |
| `registerProvisioningProvider(provider)` | Same as Pterodactyl/Proxmox |
| `on(hook, handler)` | Lifecycle hooks |
| `getConfig()` | Per-plugin JSON from admin |

### Hooks (v1)

- `order.paid` — invoice paid with an order
- `invoice.created` — invoice created
- `client.register` — client record created
- `service.provision` — provision job succeeded

## Build tip

```bash
npm init -y
npm i -D typescript
# link SDK from a QuayPanel checkout:
npm i @quaypanel/addon-sdk@file:../apexbilling/packages/addon-sdk
npx tsc --outDir dist
```

See `plugins/example-logger` for a minimal shipping example.
