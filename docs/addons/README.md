# QuayPanel addons

Plugins and themes are zip-installable packages extracted onto the server filesystem.

| Kind | Install path | Manifest | Enable |
|------|--------------|----------|--------|
| Plugin | `/plugins/<id>/` | `addon.json` | Admin → Plugins |
| Theme | `/themes/<id>/` | `theme.json` | Admin → Themes (one active) |

Built-in payment gateways (Stripe/PayPal) and provisioning providers (Pterodactyl/Proxmox) load through the same registry as external plugins.

Shipped samples:

- `themes/default` — current QuayPanel UI (tokens; core components are the fallbacks)
- `themes/midnight` — colors-only example
- `plugins/example-logger` — hook logger example (disabled until you enable it)

Production must persist `/plugins` and `/themes` (Docker volume / bind mount). Restart the Next.js app and worker after installing new packages if in-process **Reload addons** is not enough.

## Quick start

1. Scaffold a folder (`plugins/my-gateway` or `themes/my-theme`)
2. Author against [`@quaypanel/addon-sdk`](../../packages/addon-sdk) (or copy types from `src/addons/sdk.ts`)
3. Build TypeScript → `dist/index.js` (plugins; themes only if registering React views)
4. Zip the folder, extract on the server under `/plugins` or `/themes`
5. Enable / activate in admin

## Local development (`ADDON_DEV_PATH`)

Point QuayPanel at a package outside the repo while iterating:

```bash
# Windows (bash)
export ADDON_DEV_PATH="/c/dev/my-quaypanel-plugin"

# Multiple roots (OS path delimiter)
export ADDON_DEV_PATH="/c/dev/plugin-a;/c/dev/themes-wip"
```

Each path may be:

- a single addon root containing `addon.json` or `theme.json`, or
- a directory of addon folders (same layout as `/plugins` / `/themes`)

Then use **Reload addons** in admin (or restart).

## Docs in this folder

- [Plugins](./plugins.md) — gateways, providers, hooks
- [Themes](./themes.md) — tokens, CSS, shells, view overrides
- [Scaffold](./scaffold.md) — folder templates and packaging
