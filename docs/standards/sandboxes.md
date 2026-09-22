# Sandboxes

The two places in this repo that run code somebody else wrote, so the rules here are about the
boundary rather than about style.

`apps/macro-sandbox` is three Lambda container runtimes that execute user-authored macros, one per
language: Python, JavaScript and R. `apps/calibration-sandbox` is one generic Lambda that executes
device-calibration scripts, where the event carries the script, the captured series, the parameters
and the output schema, and the handler validates what the script submits against that schema before
returning.

## Read first

- `apps/macro-sandbox/README.md` and `apps/calibration-sandbox/README.md`, whose trust model section
  is the thing to read before changing anything.
- `infrastructure/modules/macro-sandbox` and the calibration sandbox module, which deploy them.

## Shape

Both are Lambda containers with a handler, a wrapper that bounds the untrusted code, a fixture
corpus and a compose file for running them locally.

```text
apps/macro-sandbox/functions/{python,javascript,r}/   one Dockerfile and handler each
apps/macro-sandbox/lib/{helpers,wrappers}/            shared helpers, the per-language wrapper
apps/macro-sandbox/test/{data,scripts}/               the fixture corpus and the scripts that keep it
apps/calibration-sandbox/functions/                   the single generic handler
apps/calibration-sandbox/lib/                         the wrapper, the quality gates
apps/calibration-sandbox/tests/                        pytest
```

There is no build step beyond `docker build`. `dev` is `docker compose up --build`, and an
`invoke` script posts a fixture event to the local Lambda runtime interface.

## Rules

1. Within `macro-sandbox`, the three handlers implement one contract. A change to the input or
   output shape of one is a change to all three, in the same pull request, or the backend gets
   different answers depending on which language a researcher chose. [review]
2. A user's macro runs inside the wrapper, never directly. The wrapper is what bounds it and shapes
   its result, so logic that belongs to the platform goes there rather than into the handler.
   [review]
3. Treat every submitted script as hostile input. It is arbitrary code from someone with an
   account, so anything the handler does with its output is validation, not trust. The calibration
   handler validating submitted blocks against the event's schema is that rule made concrete.
   [review]
4. Fixtures under `test/data/` are maintained by the scripts in `test/scripts/`, not hand-edited.
   [review]
5. A test that needs the composed stack skips with a message when its key is absent rather than
   failing. Silence is worse than either, because a skipped suite that looks green hides the fact
   nothing ran. [review]
6. Nothing in either app hard-codes a region, an account or a bucket. That belongs to the
   infrastructure module. [review]
7. Nothing family-specific or device-specific lives in a sandbox. The calibration runtime is generic
   and the event carries everything it needs, which is what keeps one Lambda serving every device
   family. [review]

## Tests

`macro-sandbox` has two vitest configurations: the default one runs against the composed stack,
brought up by `test:up` and gated on `MACRO_SB_TEST_KEY` being present, and the container
configuration runs the handler inside its image. `calibration-sandbox` uses pytest, three files
today.

## Known debt

A single spec covers the three macro runtimes that execute untrusted code. The gap worth closing
first is a shared conformance suite: the same fixture through all three handlers, asserting
identical output, which would catch the drift rule 1 exists to prevent. Needs a ticket.

The two sandboxes solve the same problem twice, with their own wrapper, their own fixture handling
and their own compose file. That is defensible while their event shapes differ, and worth revisiting
if a third one ever appears. No ticket.

## Decisions

- 2026-09-21. The three macro runtimes stay as three separate images rather than one polyglot image.
  The images are already large, and a shared base would couple the R toolchain's size to every
  Python invocation.
- 2026-09-22. `apps/calibration-sandbox` is documented here rather than in its own standard, because
  the rules that matter for it are the boundary rules it shares with the macro runtimes.
