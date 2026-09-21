# Documentation site

`apps/docs`, the public documentation. Fumadocs on Next.js, statically exported.

The prose rules are [prose.md](prose.md). The workflow for keeping documentation in step with a
feature, including the privacy rules on screenshots, is the `openjii-docs-update` skill.

## Read first

- `apps/docs/README.md`.
- The `openjii-docs-update` skill before you change anything a user reads.

## Shape

```text
content/guide/         for researchers: get started, experiments, measuring, devices, analysis
content/guide/reference/glossary.mdx    the shared vocabulary for the whole repo
content/developers/    for integrators: architecture, contributing, extending
content/developers/design-decisions/    the architecture decision records
scripts/               the validation scripts CI runs
```

## Rules

1. A change that alters what a user sees or does updates `content/` in the same pull request, and
   any screenshot showing the affected screen is re-captured rather than reused.
   [hook: docs-reminder]
2. The glossary is the vocabulary for the whole repository, not only for this site. Use its terms,
   and when a term is missing, either the project does not use that word or the glossary has a gap
   worth closing here. [review]
3. An architecture decision goes in `content/developers/design-decisions/` from
   `adr-template.mdx`. A record explains why a decision went one way; a standard says what the rule
   is. Do not put rules in records or history in standards. [review]
4. Generated specs are synced, never edited. `sync-specs` regenerates the OpenAPI document from
   `packages/api` and copies it here along with the AsyncAPI file. [ci: docs_spec_drift]
5. The MQTT contract in `asyncapi.yaml` is hand-written, so a change to the ingest schema or the
   bronze pipeline has to be reflected here by hand. CI diffs the pipeline and the schema against
   this file and fails closed. [ci: docs_spec_drift]
6. Record the commit a page was verified against in its `verified:` comment when you check it, so
   the next person knows how stale it is. [review]
7. Build locally before pushing. The link and media checkers catch a broken internal link or a
   missing image, and they run in CI either way.
   [ci: check-internal-links] [ci: check-media-references]

## Patterns

**Following a feature.** Change the code, then find every page that shows the affected screen,
update the words, re-capture the screenshots on a seeded local stack, and check the privacy rules in
the skill before you commit an image.

**A diagram.** Use a ```mermaid fence. A remark plugin rewrites them before the default plugins run,
so a diagram that renders in a preview will render on the site.

**Adding a decision record.** Copy `adr-template.mdx`, state the context, the decision and what was
rejected. A record is not edited once it is accepted; a later record supersedes it.

## Known debt

`content/developers/contributing/index.mdx` and the root `CONTRIBUTING.md` are two hand-maintained
copies of the same guide and they already disagree about which commands verify a change. The root
file is the one the pull request template and the release tooling refer to, so this page should
shrink to a pointer. Needs a ticket.

`content/guide/reference/access-troubleshooting.mdx` has 36 em dashes, the most of any file in the
repo, against rule 2 of [prose.md](prose.md). No ticket.

Build artefacts sit in the working tree. They are ignored by git, so this only matters when you are
grepping. No ticket.

## Decisions

- 2026-09-21. The OpenAPI and AsyncAPI copies stay committed rather than generated at build time, so
  the drift check has something to diff against and a reviewer can see an API change in the diff.
