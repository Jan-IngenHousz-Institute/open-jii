# Shared components

`packages/ui`, the component library the web app and the status page render with, plus the colour
and typography contract the whole platform is built on. The docs site does not import it, and
mirrors a few token values by hand in `apps/docs/app/global.css`.

Mobile does not use this package. It has its own components under `src/shared/ui` and its own token
set, described in `apps/mobile/docs/styling.md`.

## Read first

- `packages/ui/src/styles/theme.css`, which is where every colour in the platform is defined. Its
  header comment explains the swap procedure and states that nothing else defines a colour. The web
  app imports it from `apps/web/app/globals.css`.
- `packages/ui/components.json`, which is what `pnpm ui-add` reads.
- `packages/ui/eslint.theme.config.js`, whose comment explains why this package's `lint` script runs
  only the theme guard.

## Shape

```text
src/components/<name>.tsx        66 components, one per file, kebab-case
src/components/charts/           42 files: the Plotly chart family and its runtime
src/components/list-filter/      the parts of the Filter menu and its chips
src/components/map/              the map layer
src/hooks/                       the seven exported hooks
src/lib/utils.ts                 cn and friends
src/styles/theme.css             the colour, radius and font contract
src/components/__tests__/        the component tests, including charts/ and map/
src/hooks/__tests__/             the hook tests
```

There is no build step and no `dist`. The `exports` map points at `./src/...` directly, so a change
here is live in the web app without rebuilding anything.

## Rules

1. Components are vendored shadcn in the "new-york" style. Add one with `pnpm ui-add`, which runs
   the shadcn CLI and then prettier, rather than hand-copying a file from the docs. [review]
2. One component per file, kebab-case, at the top level of `src/components/`. A component that only
   makes sense inside another still gets its own file. [review]
3. Colour, radius and font come from the custom properties in `packages/ui/src/styles/theme.css`
   and nothing else. No Tailwind palette class such as `bg-blue-500` and no arbitrary
   `bg-[#123456]`. Use the semantic token: `bg-card`, `text-foreground`, `border-border`,
   `--chart-1` through `--chart-5`, and the repo's own `--status-*`, `--node-*`, `--brand-*` and
   `--canvas-*` families. [lint: no-restricted-syntax]
4. Do not write a colour in code, such as a hex string in a chart helper. Read a chart's colours
   back with `readThemeColor` instead. The lint rule reads class strings in `.tsx` files only, so
   nothing else catches this. [review]
5. A new visual that needs a colour the tokens do not have gets a new token, declared identically
   in `:root` and `.dark` and exposed through the `@theme inline` block. It does not get a literal
   with a lint disable. [lint: no-restricted-syntax]
6. Consumers import by explicit subpath, and only the subpaths in `exports` are importable. Adding
   a new public module means adding it to that map on purpose. [review]
7. A chart component goes in `src/components/charts/` on top of the shared `plotly-chart.tsx`
   wrapper, and uses the shared `colorway.ts`, `utils.ts` and `use-chart-theme-refresh.ts` rather
   than its own copy of that logic. It never imports the Plotly runtime itself, and a trace type it
   emits is listed in `plotly-trace-types.ts` as eager or lazy, with a loader in `plotly-runtime.ts`
   for a lazy one, because an unlisted type draws as scatter. Keep a new chart structurally similar
   to its siblings; they are read as a family and a renderer that looks nothing like its twin is
   harder to maintain than one that is slightly less clever. [review]
8. A chart never assumes a browser at import time. The web app loads every chart through
   `next/dynamic` with `ssr: false`, and that only works if the module does not touch `window` while
   being imported. [review]
9. Tests go in a `__tests__/` directory under the folder they cover, `src/components/__tests__/` or
   `src/hooks/__tests__/`, which is this package's convention and differs from the rest of the
   repo. Follow it here. [review]
10. Anything that moves on its own checks `usePrefersReducedMotion` from
    `src/hooks/use-prefers-reduced-motion.ts` first, as `carousel.tsx` and `use-rotation.ts` do.
    [review]

## Patterns

**Adding a component.** Run `pnpm ui-add <name>`, then read what it generated: the vendored output
usually needs the theme tokens applied and sometimes needs a class trimmed. Export it by adding
nothing, because `./components/*` already covers it.

**Changing the palette.** Replace the values in both `:root` and `.dark` from a tweakcn export, then
re-derive the repo-owned families and re-apply them. The file's header comment is the procedure, and
it is the one place to do this. The docs site mirrors a few values in `apps/docs/app/global.css`, so
update those by hand when the primary colour changes.

**A chart that needs a new interaction.** Look at the nearest existing chart first. The family
shares its theme refresh, its compact-mode hook, its colourway and its PNG export, so an interaction
added outside those will drift from the others the first time the theme changes.

**A filter on a list.** Add it to the existing Filter menu through `list-filter-menu` rather than
building a toolbar of selects, and let `list-filter-chips` show what is active.

## Tests

Vitest with jsdom and React Testing Library, 85 files, all under `__tests__/`. Chart tests live in
`src/components/__tests__/charts/` and hook tests in `src/hooks/__tests__/`. Because Plotly needs a
real layout engine, apps mock `@repo/ui/components/charts/*` rather than rendering them, so the only
place a chart is genuinely exercised is here.

## Known debt

`eslint.config.js` ignores `src/**` entirely, so the 66 components and 42 chart files get only the
theme rule and a few React hooks rules, both on `.tsx` files, and `pnpm lint` in this package runs
only those. The comment in `eslint.theme.config.js` is honest about why: the full type-aware config
reports about 2,600 problems across the vendored components. The consequence is that 178 type
assertions live here, 56 of them `as any`, along with 23 non-null assertions, all invisible to the
rules every other package obeys. Replacing the blanket ignore with an explicit list of legacy files
would at least hold new code. Needs a ticket.

`src/components/charts/colorway.ts`, `charts/utils.ts` and six other chart and map files write
colours in code, 26 hex or `rgb()` matches in all, for example the categorical palette and the
light and dark chart chrome. The lint rule cannot see them, and rule 4 asks for tokens. No ticket.

`src/components/chart.tsx` is the vendored shadcn recharts wrapper, and nothing in the repo imports
it. Delete it together with the `recharts` dependency, or say what it is kept for. Needs a ticket.

There are both a `map.tsx` and a `map/` directory. No ticket.

`apps/web/app/globals.css` carries a commented-out `@import "leaflet/dist/leaflet.css";`, which
[prose.md](prose.md) says to delete. No ticket.

## Decisions

- 2026-09-21. This package stays consumed from source with no build step. It keeps the edit loop
  immediate, and the cost is that consumers compile it, which is already true of the web app and the
  status page.
- 2026-09-21. `__tests__/` stays this package's convention rather than being colocated to match the
  apps. All 85 files already follow it and renaming them changes nothing.
- 2026-11-04. The theme tokens moved from `apps/web/app/globals.css` into
  `packages/ui/src/styles/theme.css`, so the package owns its contract and a second consumer,
  `apps/status`, imports it.
- 2026-11-16. This document was reconciled with `main` on 16 November 2026, and the counts, paths
  and tags that had drifted were corrected.
