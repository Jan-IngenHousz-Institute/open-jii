# pageview-collapse

**Pageviews have fallen off while the infrastructure reports itself healthy.** This is the
white-screen deploy: CloudFront serves 200s, the Lambda is not erroring, every AWS metric is green,
and users see nothing. It is the failure the rest of this catalog structurally cannot detect,
because every other signal watches the server.

## Rule out the boring explanation first

A collapse in _reported_ pageviews is not always a collapse in _actual_ pageviews. If the analytics
proxy is what broke, tracking stops while the site is fine. The two look identical from PostHog and
completely different from CloudFront:

Check CloudFront request counts for the same window. Requests steady while pageviews fell means
tracking broke, which is a real problem but not an outage. Requests falling with pageviews means the
site is genuinely unreachable or unusable.

## Then open the site

Load it yourself, in a private window, on the affected environment. A white screen with a clean
network tab and a console exception is the classic shape, and `client-error-spike` will usually be
firing alongside with the signature that explains it.

## Roll back on correlation, not on diagnosis

If the onset matches a web deploy, roll back first. A blank platform is not a state to debug in
production, and the deploy correlation is almost always the answer:

```bash
git log --since="6 hours ago" --oneline origin/main
```

## Why this is critical severity

Every other alarm in this program fires when something is broken. This one fires when everything
looks fine and the platform is unusable anyway, which is the failure most likely to go unnoticed for
hours. Treat it as a page even though no server-side metric agrees with it.

## Producer status

Inactive until the PostHog insight alert is configured. Pageview capture itself is already live.
