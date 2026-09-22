# TypeScript

The rules in here hold in every workspace that compiles TypeScript, which is every app and package
except `apps/data`. Where a component document says something more specific, that one wins, and it
will say so.

Nothing about layering, file placement or naming is here, because those differ per component and
live in the component's own document. This is about the language.

## Read first

- `tooling/eslint/base.js`, which is where the shared rules actually live.
- [prose.md](prose.md) for comments and TSDoc.
- Your component's document for where a file belongs.

## Rules

### Types

1. Do not write type assertions. No `as X`, no `as unknown as X`, no `as never`. If the type is
   wrong, narrow it with a guard, fix the type it came from, or change the signature that forced
   your hand. An assertion silences the compiler on the one question you wanted it to answer.
   [review]
2. When a typed object has to flow into a parameter shaped like `Record<string, unknown>`, try
   spreading it first, since `{ ...value }` usually satisfies the parameter without a cast. If even
   that fails, write one named helper with a short TSDoc explaining the gap rather than scattering
   casts at call sites. [review]
3. Do not use `any`, and do not reach for it to get out of a generic that fights you.
   [lint: @typescript-eslint/no-explicit-any] The unsafe assignment, call, member access, return and
   argument rules from the type-checked preset back this up, so a stray `any` tends to fail in
   several places at once.
4. No non-null assertions. Narrow with a type guard, or throw an error that says what was missing
   and where it should have come from. [lint: @typescript-eslint/no-non-null-assertion]
5. Object shapes are declared with `interface`. A `type` alias is for unions, intersections,
   mapped and conditional types, and function signatures.
   [lint: @typescript-eslint/consistent-type-definitions]
6. Import types with `import type`, kept as their own statement rather than mixed into a value
   import. [lint: @typescript-eslint/consistent-type-imports]
   [lint: import/consistent-type-specifier-style]

### Structure within a file

7. Behaviour belongs to the thing that owns it: a use case, a repository, an entity, a component,
   a store. A file named for a grab bag, such as anything ending in `-utils`, is a sign that some
   class or module is missing. The exceptions are pure data primitives with no domain knowledge,
   like a formatter or a shape converter, and `packages/api/src/transforms`, which exists so both
   apps share one implementation. [review]
8. No `export *`, and no package-wide barrel. A package's public surface is the subpaths in its
   `exports` map, and importers name the module they want. A small entry point that re-exports a
   handful of named things from one domain is acceptable when it keeps a stable import path; a root
   barrel that pulls in the whole package is not, because it defeats tree shaking and slows every
   build that touches it. [review]
9. Break a function body up with blank lines, the way you would if you were writing it out by
   hand. Twenty statements in an unbroken column is harder to read than the same code in four
   groups, and the groups tell the next person where the seams are. In practice that means a blank
   line after the guard clauses and before the work starts, between fetching something, acting on
   it and shaping what you return, before a `return` that ends a long body, between the hooks, the
   derived values and the handlers in a component, and between arrange, act and assert in a test.
   The opposite mistake is padding: no blank line straight after an opening brace or straight
   before a closing one. [review]
10. Put braces on an `if` whose body does any work. The one exception is a guard clause that
    leaves the block immediately on the same line, which is `return`, `continue`, `break` or
    `throw` and nothing else. As soon as the body does something and carries on, it gets braces and
    its own lines. [review]
11. Give a non-obvious condition a name. `const isTouched = ...` reads better than the same
    expression inside an `if`, and when two files compute the same flag, share the computation
    rather than the expression. [review]
12. Do not map a key to a field with a chain of `if (name === "a")` branches. Type the target as a
    record and index into it. [review]

### Defensiveness and validation

13. Validate at the edges. The zod schema in `packages/api` guards the wire, react-hook-form with a
    zod resolver guards the form, and an adapter guards what an external service hands back.
    Everything inside those edges trusts its inputs. [review]
14. Do not guard against states that cannot happen. A `if (!x) return` for a value the types say is
    always present is noise, and the linter will often say so.
    [lint: @typescript-eslint/no-unnecessary-condition]
15. Read environment variables through the validated env module, never `process.env` directly, so
    a missing variable fails at boot with a name rather than at runtime as `undefined`.
    [lint: no-restricted-properties]
16. For a feature that has not shipped, do not write backwards compatibility. No backfills, no
    defensive defaults for old local data, no migration for a schema only your machine has. A
    schema break is clean and the local database gets wiped. [review]
17. Delete rather than deprecate inside the repo. There are no external consumers of these
    packages, so a rename is a rename. [review]

### Working with what is already there

18. Copy the closest sibling before inventing anything. Every component document names its
    exemplars, and matching them matters more than a locally better idea, because the next reader
    navigates by pattern. [review]
19. Reach for the standard library or the library already in the dependency list before writing a
    mechanism. Walking the DOM by hand, measuring text in a hidden render or hand-rolling a
    scheduler usually means something upstream is shaped wrong, and the upstream shape is the thing
    to fix. [review]
20. Prefix a deliberately unused binding with an underscore, which is how the linter is configured
    to recognise intent. [lint: @typescript-eslint/no-unused-vars]
21. Formatting, including import order and grouping, is prettier's job and is not up for debate in
    review. [lint: prettier/prettier]

## Patterns

**Narrowing instead of asserting.** `apps/backend/src/common/utils/fp-utils.ts` is the pattern worth
copying: `isSuccess()` and `isFailure()` are type guards, so a caller that checks one gets the
narrowed type for free and never needs a cast to reach `.value` or `.error`.

**Making the illegal state unrepresentable.** When a function keeps needing a cast, the input type
is usually too wide. `ValidationResult` in
`packages/api/src/domains/experiment/visualizations/experiment-visualization-role-rules.ts` is a
union of `{ ok: true }` and `{ ok: false; issues }`, so checking `ok` gives you the issues without
an assertion.

**One named helper instead of scattered casts.** If a type gap is real and cannot be closed, put it
in a single function whose TSDoc says what the gap is and why it cannot be fixed yet. One reviewable
place beats fifteen invisible ones.

**Spacing that reads well.**
`apps/backend/src/experiments/application/use-cases/create-experiment/create-experiment.ts` is worth
looking at for rule 9 alone. The opening log, each guard, the duplicate-name check, the create call
and the location handling are all separated, so you can see the shape of the function before reading
any single line of it. Nothing in prettier produces that; it is a choice the author made.

## Known debt

There are 926 type assertions in non-test source, plus another 1,211 in test files, so rule 1 is
aspiration-shaped in practice even though it is the rule going forward. They are spread as follows:
284 in `packages/ui`, 257 in `apps/web`, 159 in `apps/mobile`, 91 in `apps/backend`, 35 in
`packages/iot`, and the rest in single digits across the other packages. Most are narrowing casts
rather than `any`, which is the milder half of the problem. No ticket for the backlog itself.

A lint rule for rule 1 cannot land as an error while those 926 exist. The plan is
`@typescript-eslint/consistent-type-assertions` with `assertionStyle: "never"`, introduced as a
warning, then promoted to an error per package as each one reaches zero, starting with the packages
already in single digits. Needs a ticket.

`packages/ui/eslint.config.js` ignores `src/**` entirely, so all 63 components are linted for theme
tokens only and nothing else. That is where 58 of the repo's 67 `as any` casts sit, unseen by the
type-checked rules every other package gets. Replacing the blanket ignore with an explicit list of
legacy files would put new code under the real config. Needs a ticket.

Only `apps/web` opts into `restrictEnvAccess`, so rule 15 is enforced in one workspace out of
sixteen. The backend, mobile and every package can still read `process.env` directly. Needs a
ticket.

Nine `export *` statements remain, in three files: `packages/database/src/index.ts`,
`packages/i18n/src/index.ts` and
`packages/api/src/domains/experiment/experiment.schema.ts`. The i18n one is the clearest break with
rule 8, since `@repo/i18n/client` and `@repo/i18n/server` already exist and consumers could import
them directly. Needs a ticket.

Eleven files are named for a grab bag rather than a responsibility, against rule 7, including
`apps/backend/src/common/utils/stream-utils.ts`, `apps/web/components/react-flow/flow-utils.ts` and
`apps/mobile/src/features/connection/services/device-connection-manager/device-utils.ts`.
`fp-utils.ts` is the deliberate exception: it is the `Result` and `AppError` implementation and the
name is historical. Move an item onto its owner when you next touch it. No ticket.

Rule 10 describes the house style rather than correcting it. There are 1,625 braceless single-line
`if` statements in non-test source, 718 of them in `apps/web` and 330 in `apps/mobile`, and almost
all of them are guard clauses: 334 end in `return`, 160 in a bare `return;`, 39 in `continue;` and
14 in a `throw`. A handful do real work on the same line, such as the three in
`apps/backend/src/common/utils/orpc-fp.ts` that assign to a log object, and those are the ones to
put braces on when you are next in the file. No ticket.

## Decisions

- 2026-09-21. Type assertions are banned in the rule text rather than allowed with an escape hatch,
  even though 926 exist. Writing the escape hatch down would get it used, and the count is the
  argument for a warning-first lint rule, not for a softer rule.
- 2026-09-21. A small named-export entry point for one domain stays allowed while `export *` and
  root barrels do not, which is the line that keeps import paths stable without dragging a whole
  package into every build.
- 2026-09-21. `packages/api/src/transforms` is a named exception to rule 7. The alternative is the
  same conversion logic implemented twice, once in web and once in the backend, which is worse than
  a directory of pure functions.
- 2026-09-21. Rule 10 allows the braceless guard clause instead of demanding braces everywhere. The
  repo has 1,625 of them and they are nearly all early returns, which is the normal idiom in this
  language; the thing actually worth forbidding is a braceless body that does work and then carries
  on.
- 2026-09-21. Rule 15 keeps `process.env` out of application code even though only `apps/web`
  enables the rule today. The backend reads it directly in at least
  `apps/backend/src/common/utils/orpc-fp.ts`, which is the kind of place a missing variable turns
  into silently different behaviour rather than a boot failure.
