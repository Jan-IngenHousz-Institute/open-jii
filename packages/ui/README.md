# @repo/ui

Shared React component library for openJII web surfaces — shadcn/Radix primitives (buttons, dialogs, forms, sidebar) plus richer building blocks: charts (Plotly, Recharts), maps (Leaflet), rich text (Quill), and form handling (react-hook-form).

Components are consumed via subpath imports, e.g. `@repo/ui/components/button`. Theme tokens live in the consuming app (see `apps/web/app/globals.css`) on top of the shared Tailwind preset in `tooling/tailwind`.

Add a new shadcn component:

```bash
pnpm ui-add
```
