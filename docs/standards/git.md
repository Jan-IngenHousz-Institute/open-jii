# Branches, commits and pull requests

How work gets from a checkout to production. The pull request contract itself, including the Linear
relation lines and the exemptions, is
[CONTRIBUTING.md](../../CONTRIBUTING.md#pull-request-and-release-metadata), which is the source of
truth. This document covers the surrounding habits and the checks to run before calling something
done.

## Rules

1. Branch names are `<type>/<slug>`, for example `fix/heatmap-time-axes`. No ticket reference in the
   name; the reference belongs in the pull request body where the tooling reads it. [review]
2. Create a branch from a local base, `git switch -c new-branch main`. Creating it from
   `origin/main` silently sets that as the upstream, and a later push lands somewhere you did not
   intend. If you do use a remote ref, pass `--no-track`. [review]
3. `main` is protected. The remote enforces it and a local hook blocks destructive git while you are
   on it, as well as any push to it from anywhere. On your own branch nothing is restricted: force
   push, reset and clean as you like. [hook: protect-main]
4. A commit subject is one line in Conventional Commit form. No body, no co-author trailer, no
   emoji. Keep each commit focused on one thing. [review]
5. The pull request title is what the release is cut from, because a squash merge makes it the
   commit subject on `main` and semantic-release reads it. `feat` is a minor release, `fix`, `perf`
   and `revert` are patches, a breaking change is major, and `docs`, `style`, `chore`, `refactor`,
   `test`, `build` and `ci` release nothing while still appearing in the changelog.
   [ci: validate_pr] [ci: Linear ref check]
6. The body carries the Linear relation lines. A pull request is ready for review only when its
   title and body satisfy the contract in `CONTRIBUTING.md` and the reference check can pass.
   [ci: Linear ref check]
7. Run the full gate before you call work done, on every branch of a stack and not only the top one:

   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm lint
   pnpm turbo run check-types
   pnpm test
   pnpm format:check
   ```

   A red pull request wastes a reviewer's time on something you already know is broken. [review]

8. Run the backend suite on its own rather than inside a parallel turbo run. Its timeouts are tight
   enough that load makes healthy tests fail, and a failure you cannot reproduce alone is usually
   this. [review]
9. Fixes for review comments stay inside the lines your branch already touched. A pre-existing
   problem you noticed gets named as pre-existing, in the review thread or a ticket, not fixed
   inline. [review]
10. A squash merge collapses a branch into one commit, which breaks a stack built on top of it.
    Rebase the rest of the stack after each merge, or keep the stack short enough that it does not
    matter. [review]
11. An agent commits, pushes or opens a pull request only when the person asks for it in those
    words. A factual correction, an answer to some other question, or approval of a plan is not
    permission to push. [review]

## Patterns

**Splitting work.** When a branch is going to be large, split it before writing rather than after.
Present the split as a tree off `main` with an estimate of size and file count per branch and what
depends on what, because that is the form the ordering is obvious in.

**Handing work back without opening a pull request.** Provide the exact title and the exact Linear
relation lines the author should use, so the contract is satisfied without you having opened
anything.

**Working on several things at once.** Use a worktree per branch under `.claude/worktrees/`, which
keeps each branch's build output separate. Remember that the stash stack is shared across
worktrees, so prefer a temporary commit over a stash.

## Known debt

Nothing enforces rule 4's one-line rule or rule 9's scope discipline. Both are review habits, and
both are the kind of thing that only shows up when someone is in a hurry. No ticket.

## Decisions

- 2026-09-21. Ticket references stay out of branch names. The pull request body is where the tooling
  looks, and a reference in the branch name is noise that also survives longer than the branch.
- 2026-09-21. The gate is run locally before review rather than relied on in CI. CI is the backstop,
  not the first place to find out.
