# Addon scaffold & packaging

CLI scaffold (`npx quaypanel-addon create …`) is planned; until then copy the samples.

## Plugin template

```
plugins/<id>/
  addon.json
  dist/index.js
  README.md
```

Minimal `addon.json`:

```json
{
  "id": "<id>",
  "name": "Display Name",
  "version": "0.1.0",
  "type": "plugin",
  "entry": "dist/index.js",
  "provides": [],
  "hooks": []
}
```

## Theme template

```
themes/<id>/
  theme.json
  assets/theme.css
```

Start from `themes/default` for token maps that match the product.

## Zip for distribution

From the addon folder parent:

```bash
zip -r my-plugin-1.0.0.zip my-plugin
```

On the server:

```bash
unzip my-plugin-1.0.0.zip -d /path/to/quaypanel/plugins
```

Then Admin → Plugins → Enable (or Themes → Activate). Use **Reload addons**, then restart app + worker if the entry failed to load.

## Checklist

- [ ] Folder name === manifest `id`
- [ ] Plugin has `dist/index.js` exporting `register(api)`
- [ ] Theme tokens / CSS validated in light and dark
- [ ] No secrets committed in the zip (use admin config)
- [ ] Documented `engines.quaypanel` if you depend on a minimum host version
