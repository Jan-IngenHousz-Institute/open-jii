# OJD-1768 validation media

Playwright captures for PR #2017, recorded against the local web and backend stack at feature
commit `20ac861a4` after rebasing onto `main` commit `b796f3f74`.

The response fixture contains only synthetic experiment, device and user identifiers. Its row mix
exercises onboarded-and-sending, onboarded-but-silent, unbound registered and unregistered
publishers. Measurement counts were calibrated from 30-day aggregate queries against the dev and
prod lakehouses; no remote identifier or row-level value was copied into these assets.

- `experiment-devices-light.webp` and `experiment-devices-dark.webp`: the complete Devices tab.
- `experiment-devices-navigation.webm`: experiment overview to Devices tab.
- `experiment-devices-detach.webm`: open and cancel the detach confirmation.
- The two poster images are the first frames for the recordings.
