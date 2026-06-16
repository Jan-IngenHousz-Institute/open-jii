# Workbooks

A **workbook** is a notebook-style sequence of cells — protocols, macros, questions,
markdown and branches — that you assemble to design and run a measurement. Protocol and
macro cells reference shared, reusable entities from the **Library**, so the same macro can
power many workbooks.

## Demo: editing a shared macro never breaks another workbook

<video controls width="100%" poster="/img/workbook-versioning/poster.jpg">
  <source src="/img/workbook-versioning/versioning-demo.webm" type="video/webm" />
  Your browser does not support embedded video — see the steps below.
</video>

The clip adds the **same** macro (NDVI Calculator) to two workbooks — **Flow A** and
**Flow B** — both pinned to **v1**. Editing the macro in Flow A mints **v2** and re-pins
**only Flow A**. Flow B is untouched: it still runs the original **v1** code and simply
surfaces an **"update to v2"** affordance, which Flow B adopts on its own schedule. A
mutation in one flow can no longer silently change every other flow that shares that
protocol or macro.

## How versioning works

Macros and protocols are **immutable-versioned**. You never destructively overwrite a
shared entity:

- **Editing creates a new version.** When you change a macro or protocol's code in a cell
  (or on its Library page), a new version is minted automatically. Nothing is lost — every
  earlier version is preserved.
- **Cells pin a version.** Each protocol/macro cell remembers the version it was using
  (shown as a `vN` badge on the cell). Because the cell is pinned, editing the entity does
  **not** silently change other workbooks that reference it — they keep their pinned version.
- **Opt-in updates.** When a newer version exists, the cell shows an **"update to vN"**
  button. Click it to adopt the latest code in that workbook, on your schedule.

## Version history, restore & duplicate

Open the **version-history** (clock icon) on a protocol or macro cell to:

- **Review** the version history — who changed it and when, with the current and latest
  versions marked, and how many workbooks use the entity.
- **Restore** an earlier version. Restoring mints a _new_ version from the old code, so it
  is always safe and never rewrites history.
- **Duplicate** the entity into your own copy (a fork) — handy when you want to diverge from
  a shared macro without affecting everyone else using it.

## Adding a cell

Use the **Macro** / **Protocol** buttons under a workbook to open the picker, **search** by
name (and filter macros by language), then select an entity to add it as a cell pinned to its
current latest version. You can also **create** a new macro or protocol inline from the picker.
