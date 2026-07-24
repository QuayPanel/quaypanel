# Example Logger Plugin

Sample QuayPanel plugin. Enable it under **Admin → Plugins** to log addon hooks to the server console:

- `order.paid`
- `invoice.created`
- `client.register`
- `service.provision`

Copy this folder, change `id`/`name`, and replace `register()` to add gateways or providers. See `docs/addons/plugins.md`.
