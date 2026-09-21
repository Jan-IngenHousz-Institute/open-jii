# Shared components

`packages/ui`, the component library both the web app and the docs site render with, plus the colour
and typography contract the whole platform is built on.

Mobile does not use this package. It has its own components under `src/shared/ui` and its own token
set, described in `apps/mobile/docs/styling.md`.

## Read first

- `apps/web/app/globals.css`, which is where every colour in the platform is defined. Its header
  comment explains the swap procedure and states that nothing else defines a colour.
- `packages/ui/components.json`, which is what `pnpm ui-add` reads.
- `packages/ui/eslint.theme.config.js`, whose comment explains why this package is linted twice.

## Shape

```text
src/components/<name>.tsx        62 components, one per file, kebab-case
src/components/charts/           36 files: the Plotly chart family and its runtime
src/components/map/              the map layer
src/hooks/                       the six exported hooks
src/lib/utils.ts                 cn and friends
src/components/__tests__/        the tests, including charts/
```

There is no build step and no `dist`. The `exports` map points at `./src/...` directly, so a change
here is live in the web app without rebuilding anything.

## Rules

1. Components are vendored shadcn in the "new-york" style. Add one with `pnpm ui-add`, which runs
   the shadcn CLI and then prettier, rather than hand-copying a file from the docs. [review]
2. One component per file, kebab-case, at the top level of `src/components/`. A component that only
   makes sense inside another still gets its own file. [review]
3. Colour, radius and font come from the custom properties in `apps/web/app/globals.css` and
   nothing else. No hex literal, no `rgb()`, no Tailwind palette class such as `bg-blue-500`, no
   arbitrary `bg-[#123456]`. Use the semantic token: `bg-card`, `text-foreground`,
   `border-border`, `--chart-1` through `--chart-5`, and the repo's own `--status-*`, `--node-*`,
   `--brand-*` and `--canvas-*` families. [lint: theme-tokens]
4. A new visual that needs a colour the tokens do not have gets a new token, declared identically
   in `:root` and `.dark` and exposed through the `@theme inline` block. It does not get a literal
   with a lint disable. [lint: theme-tokens]
5. Consumers import by explicit subpath, and only the subpaths in `exports` are importable. Adding
   a new public module means adding it to that map on purpose. [review]
6. A chart component goes in `src/components/charts/` on top of the shared `plotly-chart.tsx`
   wrapper, and uses the shared `colorway.ts`, `utils.ts` and `use-chart-theme-refresh.ts` rather
   than its own copy of that logic. Keep a new chart structurally similar to its siblings; they are
   read as a family and a renderer that looks nothing like its twin is harder to maintain than one
   that is slightly less clever. [review]
7. A chart never assumes a browser at import time. The web app loads every chart through
   `next/dynamic` with `ssr: false`, and that only works if the module does not touch `window` while
   being imported. [review]
8. Tests go in `src/components/__tests__/`, which is this package's convention and differs from the
   rest of the repo. Follow it here. [review]

## Patterns

**Adding a component.** Run `pnpm ui-add <name>`, then read what it generated: the vendored output
usually needs the theme tokens applied and sometimes needs a class trimmed. Export it by adding
nothing, because `./components/*` already covers it.

**Changing the palette.** Replace the values in both `:root` and `.dark` from a tweakcn export, then
re-derive the repo-owned families and re-apply them. The file's header comment is the procedure, and
it is the one place to do this.

**A chart that needs a new interaction.** Look at the nearest existing chart first. The family
shares its theme refresh, its compact-mode hook, its colourway and its PNG export, so an interaction
added outside those will drift from the others the first time the theme changes.

## Tests

Vitest with jsdom and React Testing Library, 64 files, all under `__tests__/`. Chart tests live in
`__tests__/charts/`. Because Plotly needs a real layout engine, apps mock
`@repo/ui/components/charts/*` rather than rendering them, so the only place a chart is genuinely
exercised is here.

## Known debt

`eslint.config.js` ignores `src/**` entirely, so the 62 components and 36 chart files are checked by
the theme rule and nothing else. The comment in `eslint.theme.config.js` is honest about why: the
full type-aware config reports about 2,600 problems across the vendored components. The consequence
is that 283 type assertions live here, 58 of them `as any`, more than any other workspace and
invisible to the rules every other package obeys. Replacing the blanket ignore with an explicit list
of legacy files would at least hold new code. Needs a ticket.

The theme contract for a shared package is defined in a consuming application's stylesheet,
`apps/web/app/globals.css`, which `components.json` also points at. It works because the web app is
the only consumer that matters, and it would need moving if a second app ever rendered these
components. No ticket.

Two charting libraries coexist. `src/components/chart.tsx` is the shadcn recharts wrapper, and
`src/components/charts/` is the Plotly family. Both are dependencies. No ticket.

There are both a `map.tsx` and a `map/` directory. No ticket.

`globals.css` carries a commented-out `@import "leaflet/dist/leaflet.css";`, which
[prose.md](prose.md) says to delete. No ticket.

## Decisions

- 2026-09-21. This package stays consumed from source with no build step. It keeps the edit loop
  immediate, and the cost is that consumers compile it, which is already true of every app here.
- 2026-09-21. `__tests__/` stays this package's convention rather than being colocated to match the
  apps. All 64 files already follow it and renaming them changes nothing.
