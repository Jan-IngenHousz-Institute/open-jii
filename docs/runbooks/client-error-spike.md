# client-error-spike

PostHog detected a JS exception spike or a new error type in the web app.

Likely causes: bad web deploy (correlate with deploy annotations); browser-specific regression; upstream API contract change breaking a client path.

First moves: PostHog error tracking group for the new signature; watch 2-3 session replays of affected sessions; correlate first-seen with deploy time.
