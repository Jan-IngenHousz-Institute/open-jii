# store-feed-rejects

**The serving store refused rows of one of its tables in the last ten minutes.** When the store
cannot read a row, the feed's writer halves the row's chunk until the row stands alone, inserts the
rest, and writes the refused row to `store.feed_rejects` with the store's exception code and
message. The feed keeps moving, but the store now lacks rows gold holds, and `feed_rejects` keeps
them for 90 days.

## Work the chain in order

**1. What was refused, and why?** Find the store's instance and open a session on it:

```bash
aws ec2 describe-instances --filters Name=tag:Name,Values=openjii-serving-store-<env> \
  --query 'Reservations[].Instances[].[InstanceId,State.Name]' --output text
aws ssm start-session --target <instance-id>
clickhouse-client --user openjii_monitor --query "
  SELECT source_table, code, count() AS rows, min(rejected_at), max(rejected_at), any(message)
  FROM store.feed_rejects WHERE rejected_at > now() - INTERVAL 1 DAY
  GROUP BY source_table, code"
```

Read one row with `SELECT row FROM store.feed_rejects WHERE source_table = '<table>' LIMIT 1`.

Code 0 is not the store's: the feed records it itself when Spark could not work out a batch's payload
schemas. That batch's rows went, but the fields only they carry do not show on pages until a
[reload](procedures/serving-store-reload.md) of the table rebuilds the schemas; the message says
why Spark failed. Fix that first if it repeats, then reload the table for the experiments the batch
carried. Its rows landed just before the reject:
`SELECT DISTINCT experiment_id FROM store.<table> WHERE inserted_at BETWEEN <rejected_at> - INTERVAL 10 MINUTE AND <rejected_at>`
lists them, with perhaps a few from neighbouring batches, which a reload leaves as they are.

**2. Is it the row, or the store?** A handful of rows with odd values (a value the column's type
cannot hold) is the row: the store table or the feed's normalisation needs to learn that shape,
which is a change in code. Every row of a table refused with the same code means the table and gold
disagree, usually a column whose type changed in gold without a matching store migration; fix that
before more rows pile up, and switch the feed off (`store-feed-stalled`) if it will take a while. A
table or column the store lacks never lands here: the feed waits for the migration instead.

**3. Send them again once the store can take them.** As the admin, whose password is in the Secrets
Manager secret `openjii-serving-store-<env>-admin`. Paste it at the `read` prompt, which neither
echoes it nor keeps it in the shell's history, and hand it to each command through the environment
rather than its arguments, which every process on the instance can list. A session starts in
`/usr/bin`, where it cannot write, so work from its home directory, and insert with the settings the
feed inserts with:

```bash
cd ~
read -rs ADMIN_PASSWORD
clickhouse-client --user openjii_monitor --format TSVRaw --query "
  SELECT row FROM store.feed_rejects
  WHERE source_table = '<table>' AND rejected_at BETWEEN '<from>' AND '<to>'" > rejected.jsonl
CLICKHOUSE_PASSWORD="$ADMIN_PASSWORD" clickhouse-client --user openjii_admin \
  --throw_on_max_partitions_per_insert_block=0 --input_format_skip_unknown_fields=0 \
  --query "INSERT INTO store.<table> FORMAT JSONEachRow" < rejected.jsonl
```

Only once that insert has succeeded, clear the rows it sent, then forget the password:

```bash
CLICKHOUSE_PASSWORD="$ADMIN_PASSWORD" clickhouse-client --user openjii_admin --query "
  DELETE FROM store.feed_rejects
  WHERE source_table = '<table>' AND rejected_at BETWEEN '<from>' AND '<to>'"
unset ADMIN_PASSWORD
```

A row that only the feed's normalisation can fix cannot be sent as it is, and neither can one whose
message says it was cut. Once the feed's code can send them, a
[reload](procedures/serving-store-reload.md) of their experiments does.

## Closing

Close once the cause is fixed and the refused rows are back in the store, or recorded as waiting for
a reload, and name the cause.
