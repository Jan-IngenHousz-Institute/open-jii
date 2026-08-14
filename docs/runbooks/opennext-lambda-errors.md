# opennext-lambda-errors

OpenNext server/image Lambda errors or throttles.

Likely causes: bad web deploy; env var/secret missing after rotation; upstream (backend/Contentful/PostHog proxy) timeouts cascading.

First moves: Lambda log group around first error; correlate with deploy annotations; check backend-5xx for cascade direction (web -> api or api -> web).
