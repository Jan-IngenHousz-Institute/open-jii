# Release discovery and branches

Read the current `.github/workflows/production-release.yml`, `release.yml`, `mobile-release.yml`,
`mobile-promote.yml` and the affected app's `.releaserc.js`. Workflows and version rules can change.

## Find the production baseline

```sh
gh run list --repo Jan-IngenHousz-Institute/open-jii --workflow production-release.yml --limit 30 --json databaseId,headBranch,headSha,conclusion,createdAt,url
gh run view <run-id> --json jobs
gh run view <run-id> --log
gh release list --limit 50
```

Inspect successful deployment jobs, not only the workflow conclusion. A dry run can succeed with
deployment skipped. For partial or failed deployments, the most recent successful job for each app
is its baseline even if the overall run failed. Walk back until every affected app has evidence;
paginate history if necessary. An infrastructure-only run does not advance the web baseline.

Read the actual deploy job's checked-out SHA. `headSha` can identify workflow code rather than
`inputs.ref`, and a release branch may have moved after deployment. Record run URL, job, time and SHA.
GitHub semantic tags are version labels, not proof of production rollout.

Mobile needs separate facts: production Play track version name/code and audience availability,
installed native version, and OTA channel/runtime/update if relevant. `mobile-release.yml` targets
internal testing. `mobile-promote.yml` can publish an OTA without changing the native version.
Play Console production-track evidence is authoritative for availability. EAS production build
records can verify native version/build provenance but do not prove users can download it. If access
is missing, record the mobile baseline as unknown and block forced-update activation.

## Compare the candidate

```sh
git status --short --branch
git fetch origin main --tags
git rev-parse <candidate-ref>^{commit}
gh pr view <number> --json title,body,state,baseRefName,headRefName,headRefOid,mergeCommit,url,statusCheckRollup
git log <production-sha>..<candidate-sha> --format='%H %s'
git diff --stat <production-sha> <candidate-sha>
```

Fetch missing commits or PR heads by explicit ref before testing ancestry. For an open PR,
`git merge-base --is-ancestor <pr-head> <candidate-sha>` tests inclusion; for a merged squash PR,
use its merge commit. Refresh PR metadata if its head changes. A future merge is a pending input.

Reconcile the raw range with PR identities from canonical squash `Title (#NNN)` and merge subjects.
Compare candidate PRs against the deployed history. Release hotfixes may be cherry-picked, so a
different SHA for the same PR is not a new feature. Use commit-to-PR associations via
`gh api repos/Jan-IngenHousz-Institute/open-jii/commits/<sha>/pulls` for unlabelled commits; inspect
`git cherry <production-sha> <candidate-sha>` and diffs for patch-equivalent commits. Keep unmatched
commits, reverts and partially cherry-picked PRs visible instead of discarding them by PR number.
Inspect shared packages, migrations and infra as well as app paths. Compare each app against its own
baseline when deployments differ.

Use actual release tags and the PR's release-preview CI output for proposed version labels; do not
guess a version by counting commits. A missing preview is unknown, not "no release".

## Cut the branch

The production workflow uses `release/DDMMYYYY`, including for previous-branch discovery and PR
labels. Confirm the date and candidate SHA in the packet. Check both local and remote refs first:

```sh
git show-ref --verify refs/heads/release/<DDMMYYYY>
git ls-remote --heads origin refs/heads/release/<DDMMYYYY>
```

If the requested branch already points at the candidate, reuse it. If it points elsewhere, stop and
explain the collision. Do not overwrite it or invent a same-day suffix: the workflow expects eight
digits. On a fresh date, the selected branch option permits:

```sh
git branch release/<DDMMYYYY> <candidate-sha>
git push origin refs/heads/release/<DDMMYYYY>:refs/heads/release/<DDMMYYYY>
```

Keep the current checkout and uncommitted work intact. Verify the remote SHA after pushing. A mock
only records these commands. No branch is cut until all promised candidate changes are included.

## Deployment handoff

Print a concrete dispatch command with the chosen branch, title and explicit deploy inputs from the
current workflow. Do not run it during preparation, including its `dry_run` variant.

```sh
gh workflow run production-release.yml --ref release/<DDMMYYYY> -f ref=release/<DDMMYYYY> -f title='<reviewed-title>' -f environment=prod -f deploy_infrastructure=<true-or-false> -f deploy_all=<true-or-false> -f deploy_app='<selected-apps>' -f dry_run=false
```

The branch must still point at the reviewed SHA when an operator dispatches. Using a SHA as `ref`
changes the workflow's date-based Linear/label logic, so do not silently replace the branch input
with a SHA. Report any mismatch between that workflow's previous dated branch and the verified
production baseline before handoff. Production dispatch also synchronizes Linear and labels PRs;
the skill's optional Linear post is a separate communication.

For mobile handoff, specify both the workflow ref and version. The current promote workflow checks
out its triggering ref, not automatically `mobile-v<version>`; prove ref and intended build agree.
Its fingerprint decision may choose OTA. A gate requiring a new native version needs a real native
build available on Play, regardless of the promote job's success.
