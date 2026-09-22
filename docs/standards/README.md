# Engineering standards

Each document here covers one part of the codebase and says what the code in it should look like.
Developers and agents read the same ones, so there is a single answer to "how is this done here"
instead of one answer per person.

They describe the rules, not the code as it stands. A fair amount of what is in the repo breaks
them, which is why every document ends with a list of the places that do, each with a path. When you
run into one of those, add a line to the list. It is not licence to add another.

## Reading one

The sections are the same everywhere and come in this order: scope, what to read first, the shape of
the directory, the numbered rules, patterns for the jobs that come up often, testing, known debt,
and any contradictions that have been settled, each with a date.

Scope and rules are the two worth reading before you touch a component. Shape and patterns matter
more when you are adding files than when you are changing them.

## Enforcement

Rules are uneven by nature. Some are caught by a machine, and some are only ever going to be caught
by whoever reviews the pull request. Rather than leave that ambiguous, every rule ends with a tag
saying which it is.

| Tag              | What it means                                                               |
| ---------------- | --------------------------------------------------------------------------- |
| `[lint: <rule>]` | An ESLint or ruff rule fails the build. The rule name is in the tag.        |
| `[ci: <job>]`    | A CI job fails, named as it appears in `.github/workflows`.                 |
| `[hook: <name>]` | A hook under `.claude/hooks` warns or blocks. Agents see it, people do not. |
| `[review]`       | Nothing catches it automatically.                                           |
| `[aspiration]`   | Where we want to end up, but most of the code is not there yet.             |

A `[lint]` or `[ci]` tag means a check that runs today. If we want one and have not built it, the
rule gets `[review]` and the missing check goes into the debt list, so nobody is misled about what
is actually being enforced.

## Debt

The last section of every document lists the code that breaks its own rules, one line each:

```text
- `path/to/thing.ts` does X, against rule 4. Do Y instead. OJD-1234.
```

The ticket at the end is what separates "this is going to be fixed" from "we have looked at it and
decided to live with it", which is written as "No ticket" instead. Either way it is worth knowing
before you start editing something and wonder why it looks the way it does.

These lines name real files, which is deliberate, and it is also why the documents sit in the repo
rather than on the published docs site.

## The documents

| Document                                 | Covers                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| [prose.md](prose.md)                     | Comments, documentation, commit messages, user-facing copy.                 |
| [code.md](code.md)                       | TypeScript rules that hold everywhere.                                      |
| [backend.md](backend.md)                 | `apps/backend`.                                                             |
| [api.md](api.md)                         | `packages/api`, the contract layer.                                         |
| [database.md](database.md)               | `packages/database`, schema and migrations.                                 |
| [web.md](web.md)                         | `apps/web`.                                                                 |
| [ui.md](ui.md)                           | `packages/ui` and the theme tokens.                                         |
| [i18n.md](i18n.md)                       | `packages/i18n`, and how web and mobile use it.                             |
| [testing.md](testing.md)                 | Test policy across every workspace.                                         |
| [mobile.md](mobile.md)                   | `apps/mobile`.                                                              |
| [data.md](data.md)                       | `apps/data`, the pipelines and the libraries.                               |
| [sandboxes.md](sandboxes.md)             | `apps/macro-sandbox` and `apps/calibration-sandbox`.                        |
| [docs-site.md](docs-site.md)             | Writing for `apps/docs`.                                                    |
| [shared-packages.md](shared-packages.md) | `packages/auth`, `iot`, `cms`, `analytics`, `transactional`.                |
| [tooling.md](tooling.md)                 | `tooling/*`, `turbo.json`, the root scripts.                                |
| [infrastructure.md](infrastructure.md)   | `infrastructure/`.                                                          |
| [git.md](git.md)                         | Branches, commits, pull requests, and what to run before calling work done. |

## Things that already have a home

Some of this was written down long before these documents existed, so a standard links to it rather
than restating it:

- `apps/web/TESTING.md` for testing the web app, which is detailed enough that summarising it would
  lose the point.
- [CONTRIBUTING.md](../../CONTRIBUTING.md) for pull request titles, Linear relations and how a
  release is cut from them.
- `docs/agents/ticket-standard.md` for the shape of a ticket or a project, and the bar for anything
  written into Linear.
- `apps/mobile/docs/styling.md` for mobile styling.
- The glossary at `apps/docs/content/guide/reference/glossary.mdx`, which the root `CONTEXT.md`
  points to, for the words we use for things.
- The architecture decision records under `apps/docs/content/developers/design-decisions/`. A
  standard says what the rule is; a record explains why a decision went one way and not the other.

Copying any of that here would leave two versions to keep in step, and the repo already has one of
those: `CONTRIBUTING.md` and the published contributing page have drifted apart and now disagree
about which commands verify a change.

## Changing one

Edit the document, then add a dated line under its decisions section saying what changed and why. If
the change reaches across components, or undoes something an architecture decision record already
settled, write a record instead of a line.
