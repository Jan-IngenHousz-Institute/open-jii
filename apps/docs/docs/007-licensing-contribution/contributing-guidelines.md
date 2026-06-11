# Contributing Guidelines

## Pull Request Requirements

### Linear Issue References

All pull requests must include an OJD-#### Linear issue reference in the PR title, branch name, or description. This requirement enables the production release automation to track what ships in each release.

**Examples of valid references:**

- **Title**: `feat(web): add filters shelf (OJD-1541)`
- **Branch name**: `ojd-1541-filters-shelf`
- **Description**: `Closes OJD-1541`

**Exemptions:**

PRs can be exempted from this requirement by:

- Adding the `no-linear` or `dependencies` label to the PR
- Being automated dependency updates (PR titles matching patterns like `chore(deps)`, `build(deps)`, `fix(deps)`, or containing `bump`)
- Being created by bot accounts (usernames ending in `[bot]` or containing `dependabot`, `renovate`, or `github-actions`)

A GitHub Actions workflow automatically checks for the Linear reference when PRs are opened, edited, synchronized, reopened, or labeled/unlabeled.
