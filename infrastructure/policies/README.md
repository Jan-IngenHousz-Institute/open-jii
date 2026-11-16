# Policies created by hand

These documents are applied through the console rather than OpenTofu, because the accounts they
belong to are administered in IAM Identity Center and nothing else in this repository manages them.
A change here is reviewed like code and then copied into the console by whoever administers Identity
Center.

## openjii-analyst

`openjii-analyst.json` is the inline policy of the `openjii-analyst` permission set. It is what an
agent session's AWS profile points at, and it is the boundary behind the cloud guard described in
`docs/agents/cloud-access.md`: the guard refuses a mistaken command before it is sent, and this
policy refuses it at AWS, whatever route the call took.

It works as an allow list. The first statement grants describe, list and get on the services the
estate runs, so anything not listed, every write included, is denied without being named. Three deny
statements then name what must stay out of reach even if a broader policy is ever attached beside
it, since AWS's own read-only policies include data reads:

- Object reads in every bucket except the heartbeat and status-state buckets, whose objects are
  operational state the runbooks read.
- Data and credentials: table items, stream records, secret values, decryption, function invocation
  and code, container and instance sessions, and every way of minting or assuming credentials.
- A short list of irreversible writes, as a second line behind the allow list.

Two reads are allowed on purpose and are worth knowing about. A function's configuration includes
its environment variables, so a secret never belongs in one; it goes in Secrets Manager, whose values
this policy denies. And log reads cover every log group, which a later change could narrow to the
application groups.

### Creating it

In IAM Identity Center, create a permission set named `openjii-analyst` with a session duration of
four hours, paste this file as its inline policy, and assign it to each developer in the development
and production accounts. The developer's profiles are described in `docs/agents/cloud-access.md`.

The inline policy limit is 10,240 characters once whitespace is removed, which is tighter than the
32,768-byte figure the console shows. A devkit test, `tooling/devkit/src/roles/permissions.test.ts`,
checks the size, that the allow statement only grants reads, and that every read the cloud guard
refuses is also denied here.

### Checking a change

Before pasting a change, simulate the calls it should allow and refuse, from your own terminal:

```bash
aws iam simulate-custom-policy --policy-input-list file://infrastructure/policies/openjii-analyst.json \
  --action-names ecs:DescribeServices s3:GetObject secretsmanager:GetSecretValue lambda:InvokeFunction \
  --resource-arns 'arn:aws:s3:::open-jii-iot-raw-archive-dev/x'
```

Every action but the first should come back `explicitDeny` or `implicitDeny`.
