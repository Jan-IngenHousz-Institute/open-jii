# web-server-throttles

**Lambda refused to run the web server because concurrency ran out.** Each throttled invocation is
a page request that failed. The server function has no concurrency reservation of its own, so it
draws on the account's regional pool, which it shares with every other function without one. The
sandboxes reserve their share out of the same pool: 70 in prod (three macro runtimes at 20 and the
calibration sandbox at 10), 35 in dev.

## Check the pool

```bash
aws lambda get-account-settings \
  --query 'AccountLimit.[ConcurrentExecutions,UnreservedConcurrentExecutions]'
```

The account-wide `ConcurrentExecutions` metric in `AWS/Lambda`, without dimensions, shows the peak,
and each function's own `ConcurrentExecutions` shows who used it.

## Likely causes, most common first

- **A burst of page requests.** Throttles at the start of a traffic ramp, healthy after. Compare
  with Traffic on the Platform dashboard. The web ACL limits a single client to 500 requests per
  five minutes in dev and 2,500 in prod, so a burst this size is many clients or many pages.
- **Slower renders.** An invocation holds its slot for its whole duration, so when renders slow
  down, the same traffic needs more concurrency. `opennext-lambda-errors` covers slow upstreams.
- **Another function taking the pool.** A function without a reservation scaling hard leaves the
  server nothing. The per-function metric shows which.
- **A low account limit.** An account can have a limit far below the usual default. If the first
  command shows a small number, a quota increase is the fix.

## Closing

Note which it was. If it was the pool, consider reserving concurrency for the server function so a
busy neighbour cannot take the site down.
