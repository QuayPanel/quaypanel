# Writing themes

Themes use a layered override model (Paymenter-like): tokens/CSS → shells → named views. App Router file swaps are not used for zip installs.

## Layout

```
themes/my-theme/
  theme.json
  assets/theme.css   # optional
  dist/index.js      # optional — React view registration
  preview.png        # optional
```

## Fork the default theme

1. Copy `themes/default` → `themes/my-theme`
2. Change `id` / `name` in `theme.json` to match the folder
3. Edit `tokens` for a recolor, and/or add CSS, and/or ship `dist/index.js` overrides

Colors set in Admin → Settings still apply **on top of** active theme tokens.

## `theme.json`

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "type": "theme",
  "tokens": {
    "light": { "primary": "#1d4ed8", "bg": "#ffffff" },
    "dark": { "primary": "#3b82f6", "bg": "#0f172a" }
  },
  "assets": { "css": ["assets/theme.css"] },
  "overrides": ["shell.store.header"],
  "entry": "dist/index.js"
}
```

Only **one** theme is active (`theme.activeId`). Disabling / switching away restores `default`.

## Layers

1. **Tokens / CSS** — enough for Midnight-style recolors (`themes/midnight`)
2. **Shells** — `shell.store.header`, `shell.client.sidebar`, `shell.admin.sidebar`, `shell.footer`
3. **Views** — e.g. `view.store.home`, `view.auth.login`, … (expandable)

Core layouts call `ThemeSlot` / `getThemeView`. Unregistered ids keep QuayPanel defaults.

## React overrides

```js
function register(api) {
  api.setTokens({ light: { primary: "#4c1d95" } });
  api.registerView("shell.store.header", MyHeader);
}

module.exports = { register };
```

React overrides must be prebuilt for the host React version. Color-only themes can omit `dist/`.

## Assets

CSS listed in `theme.json` is linked from the root layout as `/addons/themes/<id>/assets/...`.
