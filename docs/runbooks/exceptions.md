# exceptions

**This is what the platform's own code reported going wrong, grouped by PostHog into issues.** The
count alone says little. The table beside it on the daily report is the useful part: which issues,
whether they are new, and how many people they reached. PostHog posts new, reopened and spiking
issues to Slack itself, so nothing in Grafana alerts on this.

## Where the exceptions come from

Every exception carries `environment` and `service`:

- `web`: the browser, from visitors who accepted cookies, and the page server, for everyone.
- `backend`: server errors only (5xx), counted against the signed-in user when there is one.
- `mobile`: uncaught errors and error log lines. A developer's Metro build carries
  `build: development`, so those are ours, not researchers'.

## New, returning, or noise

Start with the rows marked New, then anything with many users. The row's menu opens the issue in
PostHog or starts `/openjii-triage` on it. The error inbox, linked from the section and from every
heartbeat dashboard's header, lists the same issues over a week, by service, with where each
happened and in which app version. From a terminal:

```bash
pnpm posthog:issues show <issue-id>   # first and last seen, and the latest stack
```

Some shapes recur:

- **Many issues at once, starting at one time.** Usually that deploy. Compare the start with the
  merges to `main` and the mobile release.
- **Network-shaped errors across services** (`Failed to fetch`, `Network request failed`, a gateway
  timeout). The API or the network was down, so check the Platform dashboard over the same window
  before treating each as a bug.
- **One issue, many events, one user.** A single browser or phone stuck in a loop. It is still a
  bug, but it reaches one person.

## Closing

A bug gets a ticket, drafted with `openjii-ticket-refine`, and the issue stays open until the fix
ships; resolve it then, so PostHog reopens it and alerts if it comes back. Noise is suppressed:
either in PostHog's issue view, or as `suppress` in the review file that `pnpm posthog:issues list`
writes, applied with `pnpm posthog:issues apply --confirm`. Never resolve an issue that is not
fixed: it reopens on its next occurrence and alerts as if a fix had failed.
