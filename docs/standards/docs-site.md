# Documentation site

`apps/docs`, the public documentation. Fumadocs on Next.js, statically exported.

The prose rules are [prose.md](prose.md). The workflow for keeping documentation in step with a
feature, including the privacy rules on screenshots, is the `openjii-docs-update` skill.

## Read first

- `apps/docs/README.md`.
- The `openjii-docs-update` skill before you change anything a user reads.

## Shape

```text
content/guide/         for researchers: get started, experiments, measuring, devices, analysis,
                       organizations, sharing, reference
content/guide/reference/glossary.mdx    the shared vocabulary for the whole repo
content/developers/    for integrators: architecture, contributing, extending, device integration
content/developers/design-decisions/    the architecture decision records and the templates
app/                   the REST and MQTT reference pages and the search route
public/, media/        images, the copied asyncapi.yaml and the capture manifests
redirects.json         legacy URLs and where they go
scripts/               the validation scripts, the spec sync and the capture tooling
```

## Rules

1. A change that alters what a user sees or does updates `content/` in the same pull request, and
   any screenshot showing the affected screen is re-captured rather than reused. A hook reminds an
   agent once per session when the session changed `apps/web` or `apps/mobile`, and nothing
   reminds a person or covers a change made elsewhere. [hook: docs-reminder]
2. The glossary is the vocabulary for the whole repository, not only for this site. Use its terms,
   and when a term is missing, either the project does not use that word or the glossary has a gap
   worth closing here. [review]
3. An architecture decision goes in `content/developers/design-decisions/` from
   `adr-template.mdx`, and into the list in `index.mdx` there. Something not yet decided starts from
   `proposal-template.mdx`. A record explains why a decision went one way; a standard says what the
   rule is. Do not put rules in records or history in standards. [review]
4. Generated specs are synced, never edited. `sync-specs` regenerates the OpenAPI document from
   `packages/api` and copies it and the root `asyncapi.yaml` into `apps/docs`.
   [ci: Docs API Spec Drift Check]
5. The MQTT contract in the root `asyncapi.yaml` is hand-written, so a change to the ingest schema
   or the bronze pipeline has to be reflected in it by hand, and the copy in `apps/docs/public`
   follows from `sync-specs`. CI compares the pipeline and the schema with the root file, and
   refuses to skip the check when it cannot diff against the base.
   [ci: Docs API Spec Drift Check]
6. Record the commit a page was verified against in its `verified:` comment when you check it, in
   the form `verified: code@<sha> <date>`, so the next person knows how stale it is. Leave a
   `NEEDS-LIVE-CHECK` comment on anything you could not confirm on a running environment, and
   remove it when you have. [review]
7. Build locally before pushing, and run `pnpm --filter docs check-links` and
   `pnpm --filter docs check-media-references`. CI runs the link check, and nothing runs the media
   check, so a missing image is caught only by whoever runs it.
   [ci: Build, Lint, & Test] [review]
8. A page that moves or is renamed gets an entry in `redirects.json`, and any link to it in
   `apps/web`, such as a `DocsHelpLink`, is updated. The static export check resolves every entry
   and every web deep link. [review]
9. A web screenshot is captured on the frame in `media/web/README.md`, and recorded in
   `media/web/manifest.json` when it deviates. [review]

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
copies of the same guide. They disagree on `pnpm format` against `pnpm format:check`, and the root
file still describes two type-check commands where `pnpm typecheck` now runs each workspace's
`check-types`. The root file is the one `AGENTS.md`, the README and the release skill refer to, so
the published page should shrink to a pointer. Needs a ticket.

`content/guide/reference/access-troubleshooting.mdx` has 37 em dashes, the most of any page, and 25
other files under `content/` carry some, against rule 2 of [prose.md](prose.md). Fix them in the
pages you are editing anyway. No ticket.

`apps/docs/scripts/check-media-references.mjs` is run by no workflow, against rule 7, so a missing
image or a capture on the wrong frame is caught only by whoever runs it. Needs a ticket.

`apps/docs/scripts/check-platform-doc-links.mjs` is run by nothing, and `validate-deployment.mjs`
now checks the web deep links it was written for. Delete it. No ticket.

`apps/docs/content/developers/` holds a committed generated cache file, in a directory named after
the tool that wrote it. Delete the directory and ignore it. Build artefacts in the working tree are
ignored by git and only matter when you are grepping. No ticket.

## Decisions

- 2026-09-21. The OpenAPI and AsyncAPI copies stay committed rather than generated at build time, so
  the drift check has something to diff against and a reviewer can see an API change in the diff.
- 2026-11-16. This document was reconciled with main on 16 November 2026.
