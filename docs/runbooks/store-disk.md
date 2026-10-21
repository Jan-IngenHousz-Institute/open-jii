# store-disk

**The serving store's data volume is above 80% full.** A full volume stops ClickHouse writing new
parts, and the pipelines' writes to the store fail. Growing the volume is an online change, so
there is time to do it without a window.

## Find what grew

Connect from a session on the instance (`aws ssm start-session --target <instance-id>`) with
`clickhouse-client --user openjii_admin --password`. The instance cannot read secrets, so take the
password from your own machine:

```bash
aws secretsmanager get-secret-value --secret-id openjii-serving-store-<env>-admin \
  --query SecretString --output text | jq -r .password
```

```sql
SELECT database, table, active, formatReadableSize(sum(bytes_on_disk)) AS size
FROM system.parts
GROUP BY database, table, active
ORDER BY sum(bytes_on_disk) DESC
LIMIT 10;
```

What the tables do not account for shows on the file system:

```bash
sudo du -xh --max-depth=2 /var/lib/clickhouse | sort -h | tail
```

## Likely causes, most common first

- **The data's own growth,** when the store's tables lead and grow steadily. Grow the volume.
- **Parts waiting for removal,** the rows with `active = 0`, which a mutation or a large merge
  leaves behind until it finishes. They clear on their own.
- **Detached parts,** in `system.detached_parts`, which ClickHouse never removes by itself.
- **System logs,** the `system` database. They keep 30 days (`system_log_retention_days` in the
  store's inputs); lower it if they lead.
- **Query spill** under `/var/lib/clickhouse/tmp`, which clears when the query ends.

## Grow the volume

1. Raise `data_volume_size_gb` in the store's inputs in `infrastructure/env/<env>/main.tf` and
   deploy. EBS resizes the volume in place, while it stays attached.
2. Wait until the modification is `optimizing` or `completed`:

   ```bash
   aws ec2 describe-volumes --filters Name=tag:Name,Values=openjii-serving-store-<env>-data \
     --query 'Volumes[0].VolumeId' --output text
   aws ec2 describe-volumes-modifications --volume-ids <volume-id>
   ```

   A second resize waits until the first is `completed`, so grow by enough at once.

3. Extend the file system on the instance with
   `sudo resize2fs "$(findmnt -no SOURCE /var/lib/clickhouse)"`. The volume has no partition, so
   there is nothing else to grow.
4. `df -hT /var/lib/clickhouse` shows the new size.

## Closing

Name what grew, and whether it grew at the data's own pace or in one go.
