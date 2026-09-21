# Macro sandbox

`apps/macro-sandbox`, three Lambda container runtimes that execute macros written by users. One per
language: Python, JavaScript and R.

This is the only place in the repo that runs code somebody else wrote, so the rules here are about
the boundary rather than about style.

## Read first

- `apps/macro-sandbox/README.md`.
- `infrastructure/modules/macro-sandbox`, which is what deploys it.

## Shape

```text
functions/python/     Dockerfile and handler.py
functions/javascript/ Dockerfile and handler.js
functions/r/          Dockerfile, a local variant, bootstrap, entry.sh, handler.R
lib/helpers/          shared TypeScript helpers
lib/wrappers/         the per-language wrapper around a user's macro
test/data/            the fixture corpus
test/scripts/         generate, init, view and edit the corpus
```

There is no build step beyond `docker build`. `dev` is `docker compose up --build`, and each runtime
has an `invoke:*` script that posts `test/event.json` to the local Lambda runtime interface on its
own port.

## Rules

1. The three handlers implement one contract. A change to the input or output shape of one is a
   change to all three, in the same pull request, or the backend gets different answers depending on
   which language a researcher chose. [review]
2. A user's macro runs inside the wrapper, never directly. The wrapper is what bounds it and shapes
   its result, so logic that belongs to the platform goes there rather than into the handler.
   [review]
3. Treat every macro as hostile input. It is arbitrary code from someone with an account, so
   anything the handler does with its output is validation, not trust. [review]
4. Fixtures under `test/data/` are maintained by the scripts in `test/scripts/`, not hand-edited.
   [review]
5. A test that needs the composed stack skips with a message when its key is absent rather than
   failing. Silence is worse than either, because a skipped suite that looks green hides the fact
   nothing ran. [review]
6. Nothing in the app hard-codes a region, an account or a bucket. That belongs to the
   infrastructure module. [review]

## Tests

Two vitest configurations. The default one runs against the composed stack, brought up by `test:up`
and gated on `MACRO_SB_TEST_KEY` being present. The container configuration runs the handler inside
its image. One `.spec.ts` today, which is thin for the risk this app carries.

## Known debt

A single spec covers three runtimes that execute untrusted code. The gap worth closing first is a
shared conformance suite: the same fixture through all three handlers, asserting identical output,
which would catch the drift rule 1 exists to prevent. Needs a ticket.

## Decisions

- 2026-09-21. The three runtimes stay as three separate images rather than one polyglot image. The
  images are already large, and a shared base would couple the R toolchain's size to every Python
  invocation.
