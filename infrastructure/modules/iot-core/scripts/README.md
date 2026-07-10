# IoT device provisioning scripts

One-off AWS CLI tooling to register a batch of AMBYTE devices as AWS IoT Things
with a certificate and policies attached. Use this for dev/manual batches; the
platform's in-app device registry is the path for day-to-day registration.

Certs attach to the **certificate**, not the thing. Private keys are returned
only once at creation and are written to the output dir (default `./iot-certs`),
which is git-ignored along with `*.pem` / `*.key` / the summary CSV. Keep those
key files safe and never commit them.

## Files

- `provision-iot-things.sh` create thing -> create/attach cert -> attach policies.
- `teardown-iot-things.sh` reverse: detach policies + principals, delete things, delete the shared cert.
- `things.txt` one thing name per line (`#` comments and blanks ignored).

## Provision

Dry run first (reads only, writes nothing):

```bash
./provision-iot-things.sh -n \
  -f things.txt \
  -m shared \
  -r eu-central-1 \
  -p open_jii_dev_iot_policy_experiment_data_ingest_v1 \
  -p open_jii_dev_iot_policy_device_scripts_v1
```

Drop `-n` to apply. `-m shared` issues one certificate for the whole batch
(fine for a dev batch that gets wiped); `-m per-thing` issues one cert per
device. Add `--profile NAME` for a named AWS profile, `-g GROUP` to also add
each thing to a thing group, `-o DIR` to change the key output dir.

## Teardown

Uses the shared cert ARN from `iot-certs/provisioning-summary.csv`:

```bash
./teardown-iot-things.sh \
  -c <SHARED_CERT_ARN> \
  -f things.txt \
  -r eu-central-1 \
  -p open_jii_dev_iot_policy_experiment_data_ingest_v1 \
  -p open_jii_dev_iot_policy_device_scripts_v1
```
