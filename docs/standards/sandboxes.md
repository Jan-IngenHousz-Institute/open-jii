# Sandboxes

The two places in this repo that run code somebody else wrote, so the rules here are about the
boundary rather than about style.

`apps/macro-sandbox` is three Lambda container runtimes that execute user-authored macros, one per
language: Python, JavaScript and R. `apps/calibration-sandbox` is one generic Lambda that executes
device-calibration scripts, where the event carries the script, the captured series, the parameters
and the output schema, and the handler validates what the script submits against that schema before
returning.

## Read first

- `apps/calibration-sandbox/README.md`, whose trust model section is the thing to read before
  changing anything, and `apps/macro-sandbox/README.md`, whose architecture section says how a macro
  is bounded.
- `apps/docs/content/developers/design-decisions/macro-sandbox-adr.mdx`, the record of why macros
  run in isolated runtimes.
- `infrastructure/modules/macro-sandbox` and `calibration-sandbox`, with the `macro-lambda` and
  `calibration-lambda` modules they compose, which create the functions.
  `.github/workflows/deploy-macro-sandbox.yml` and `deploy-calibration-sandbox.yml` build, scan and
  deploy the images.

## Shape

Both are Lambda containers with a handler, a wrapper that bounds the untrusted code, a fixture
corpus and a compose file for running them locally.

```text
apps/macro-sandbox/functions/{python,javascript,r}/   one Dockerfile and handler each
apps/macro-sandbox/lib/{helpers,wrappers}/            shared helpers, the per-language wrapper
apps/macro-sandbox/test/{data,scripts}/               the fixture corpus and the scripts that keep it
apps/calibration-sandbox/functions/python/            the one generic handler and its Dockerfile
apps/calibration-sandbox/lib/{helpers,wrappers}/      the quality gates, the wrapper
apps/calibration-sandbox/test/event.json              the event `invoke` posts
apps/calibration-sandbox/tests/                       unittest, run inside the built image
```

There is no build step beyond `docker build`. `dev` is `docker compose up --build`, and the
`invoke` scripts post a fixture event to the local Lambda runtime interface, one per language for
the macro runtimes.

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
4. Fixture scripts under `test/data/` are encrypted with `MACRO_SB_TEST_KEY` and maintained by the
   scripts in `test/scripts/`, so they are never hand-edited. [review]
5. A test that needs the composed stack skips with a message when its key is absent rather than
   failing. Silence is worse than either, because a skipped suite that looks green hides the fact
   nothing ran. [review]
6. Nothing in either app hard-codes a region, an account or a bucket. That belongs to the
   infrastructure module. [review]
7. Nothing family-specific or device-specific lives in a sandbox. The calibration runtime is generic
   and the event carries everything it needs, which is what keeps one Lambda serving every device
   family. [review]
8. A sandbox image is built and scanned on every pull request that touches it, and again before it
   ships. An accepted finding goes in the `.trivyignore.yaml` beside the function with a written
   statement and an expiry date, and is renewed or removed when the date passes.
   [ci: Docker Build (Calibration Sandbox)] [ci: Docker Build (Macro Sandbox - <language>)]
9. A sandbox image is deployed by its workflow, never by changing an image reference in OpenTofu.
   OpenTofu creates the function and ignores `image_uri`. [review]
10. The function timeout in the infrastructure module is set above the handler's own limit, so a
    script that overruns fails with the handler's message and not with a killed invocation.
    [review]

## Tests

`macro-sandbox` has two vitest configurations. The default one runs the encrypted corpus against the
composed stack, brought up by `test:up` and gated on `MACRO_SB_TEST_KEY`. The container
configuration builds the three images and checks the shared data contract in each, and it is opt-in
(`pnpm test:container`) and not run by CI. `calibration-sandbox` runs three `unittest` files inside
its own image, and skips with a message when Docker is not available.

## Known debt

The three macro runtimes have a shared contract suite in
`apps/macro-sandbox/test/handler-container.spec.ts`, but it is opt-in and CI does not run it, so the
drift that rule 1 exists to prevent is only caught when someone remembers to run
`pnpm test:container`. The corpus in `test/test.ts` is written per language, with each case naming
one. Wire the contract suite into CI. Needs a ticket.

The two sandboxes solve the same problem twice. Each Python wrapper has its own copy of the module
proxies and the audit hook, so a change to one has to be repeated in the other. That is defensible
while the event shapes differ, and worth revisiting if a third sandbox appears or the copies
diverge. No ticket.

## Decisions

- 2026-09-21. The three macro runtimes stay as three separate images rather than one polyglot image.
  The images are already large, and a shared base would couple the R toolchain's size to every
  Python invocation.
- 2026-09-22. `apps/calibration-sandbox` is documented here rather than in its own standard, because
  the rules that matter for it are the boundary rules it shares with the macro runtimes.
- 2026-11-16. This document was reconciled with main on 16 November 2026.
