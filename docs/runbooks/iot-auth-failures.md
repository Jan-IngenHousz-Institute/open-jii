# iot-auth-failures

**Devices are failing to connect or authenticate to the broker.** Each failure is a device that is
measuring into the void, or not measuring at all. This fires on a large deviation from the normal
rate rather than on any failure, because a handful a day is background noise from retries and
flapping links.

## Split the failure type first

The three Connect errors mean different things and have different fixes:

```bash
# On Linux, GNU date wants -d '24 hours ago' where BSD date wants -v-24H
aws cloudwatch get-metric-statistics --namespace AWS/IoT \
  --metric-name Connect.AuthError \
  --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 --statistics Sum
```

Repeat for `Connect.ClientError` and `Connect.ServerError`.

- **AuthError** is credentials: an expired, revoked or detached certificate, or a policy that no
  longer grants `iot:Connect` for that client id.
- **ClientError** is usually a malformed client id or a device reconnecting with a duplicate one,
  which the broker rejects by design.
- **ServerError** is AWS-side and is the one case where waiting is the correct action.

## Match it against the fleet

A sharp step usually maps to a batch of devices rather than to one. The registry knows which:
devices whose certificate was rotated recently, or is near expiry, are the population most likely
to be failing. Check `cert-expiry-horizon` in the same digest. Note that a rotation never changes a
device's status; a half-completed one leaves the row `active` with a new certificate the hardware
may never have received, so query for devices whose certificate changed in the window rather than
for a status.

## The failure this metric cannot see

A device whose certificate is fine but whose topic permissions are wrong connects successfully and
then silently publishes nothing that lands. That shows up as `stale-experiments` or as a silent
device, not here. If auth failures are flat but data has stopped, you are in the wrong runbook.

## Closing

Note which error type dominated and what the fleet had in common. Credential problems arrive in
batches because rotations and provisioning happen in batches.
