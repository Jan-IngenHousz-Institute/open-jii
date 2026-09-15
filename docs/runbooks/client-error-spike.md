# client-error-spike

**JavaScript exceptions in the web app have spiked, or a new error signature has appeared.** This is
the half of the platform CloudWatch cannot see: the request succeeded, the page was served, and then
it broke in the browser.

## Start from the signature, not the count

PostHog groups exceptions by signature, and the count matters far less than whether the signature is
new. A familiar error doubling usually means traffic doubled. A signature first seen an hour ago
means something shipped.

Correlate first-seen against `git log --since="6 hours ago" --oneline origin/main`. Web deploys are
the dominant cause, and the correlation is usually unambiguous.

## Then watch it happen

Session replay is the reason this runbook is short. Open two or three replays of affected sessions
and watch the error occur: what the user clicked, what the page was showing, whether a request was
still in flight. That answers in a minute what log archaeology answers in an hour, and it is the
only tool in the program that shows the browser's side of a failure.

## Decide whether it matters

Not every exception is an incident. An error that fires once per affected session on a page nobody
reached is noise; an error on the data table blocks the platform's core workflow. The replay
tells you which, and so does the affected-user count next to the signature.

## Check the boring cause

A browser extension or an ad blocker breaking one user's session produces a real exception that is
not the platform's fault. If the signature appears for a single user and mentions an unfamiliar
script origin, that is usually what it is.

## Producer status

Exception capture is already live in the web app. This entry stays inactive until the PostHog
insight alert that watches new-signature appearance is configured, since the capture and the alarm
are separate things.
