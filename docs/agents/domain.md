# Domain docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

This repo has one shared context at the root, with `apps/mobile/CONTEXT.md` as a scoped exception
for mobile-only vocabulary. System-wide ADRs live in
`apps/docs/content/developers/design-decisions/`, on the public docs site.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`apps/docs/content/developers/design-decisions/`**: read the ADRs that touch the area you are
  about to work in.
- **`apps/mobile/CONTEXT.md`**: a pre-existing domain glossary for the mobile app, written before
  this scheme and kept because the mobile vocabulary is genuinely its own. Read it for mobile work.
  The root `CONTEXT.md` is still the entry point, and it is where a term shared across apps belongs.

If any of these files do not exist, **proceed silently**. Do not flag their absence and do not
suggest creating them upfront. The `/domain-modeling` skill, reached through `/grill-with-docs` and
`/improve-codebase-architecture`, creates them lazily when terms or decisions actually get resolved.

## File structure

```text
/
├── AGENTS.md                  ← the router; read it first
├── CONTEXT.md                 ← points at the public glossary
├── docs/
│   └── agents/                ← this directory: skill configuration, not domain docs
├── apps/
│   ├── web/
│   ├── backend/
│   ├── docs/content/developers/design-decisions/   ← the ADRs, on the public site
│   └── mobile/
│       └── CONTEXT.md         ← app-local glossary, predates this scheme
└── packages/
```

Beyond the existing mobile-only glossary, should the repo ever outgrow one shared glossary, the
multi-context layout is a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context, with
context-scoped ADRs under each. The presence of `CONTEXT-MAP.md` at the root is the signal that the
repo has switched.

## Use the glossary's vocabulary

When your output names a domain concept, use the glossary for its scope: shared concepts use root
`CONTEXT.md`, and mobile-only concepts use `apps/mobile/CONTEXT.md`. Do not drift to synonyms the
applicable glossary explicitly avoids.

If the concept you need is not in the glossary yet, that is a signal. Either you are inventing
language the project does not use, which is worth reconsidering, or there is a real gap, which is
worth noting for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._
