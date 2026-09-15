# cert-expiry-horizon

**Device certificates are approaching expiry, or devices are stuck part-way through a rotation.**
Both are silent until the moment they are not: an expired certificate does not degrade, the device
simply stops connecting, and the first symptom is `iot-auth-failures` followed by stale experiments.

This is the rare entry that is worth acting on while nothing is wrong, which is the whole reason it
exists as a horizon rather than as a failure count.

## Find the affected devices

The device registry is the source of truth. Certificates near expiry and devices left in a
non-active state are two different populations and need different handling:

- **Near expiry, otherwise healthy.** Rotate on the normal path, in batches, before the horizon
  closes.
- **Stuck mid-rotation.** A rotation that failed partway leaves a device with a new certificate that
  was never activated or an old one that was never retired. These do not fix themselves and they do
  not always show as failures yet, because the old credential may still be valid.

## Rotation is not free

Rotating a certificate is only half the job: the device also has to receive its new credentials. A
rotation completed in the registry but never delivered to the hardware produces a device that keeps
working until the old certificate expires and then stops, which is a worse failure than the one
being prevented, because it is delayed and looks unrelated.

## Producer status

This entry is inactive until the metrics-publisher extension that reports certificate horizons
lands. It is catalogued now because the runbook is what makes the eventual alarm actionable, and the
failure mode it describes exists today whether or not anything is watching for it.

## Closing

Confirm the devices are connecting after rotation, not merely that the registry shows a new
certificate.
