# pageview-collapse

Pageviews collapsed while infrastructure looks healthy: the classic white-screen deploy. CloudFront serves 200s, Lambdas are green, users see nothing.

First moves: open the site; check PostHog error tracking and replays from the collapse window; roll back the latest web deploy if it correlates; verify the PostHog ingest proxy itself is not the thing that broke (a tracking outage mimics a traffic collapse: cross-check CloudFront request counts, which stay normal in that case).
