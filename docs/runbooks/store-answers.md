# store-answers

**No uptime has arrived from the serving store for five minutes.** The CloudWatch agent on the
store's instance scrapes ClickHouse's Prometheus endpoint (port 9363) every minute and ships its
uptime, so the series stops when ClickHouse stops answering, or when the instance or the agent
stops. While ClickHouse is the cause, the pipelines cannot write to the store and nothing can read
from it.

If `store-memory` and `store-disk` are still reporting, the instance is up and the cause is
ClickHouse or the agent's shipping of its scrape. If all three went quiet together, the instance or
the agent is.

## Work the chain in order

**1. Is the instance running?**

```bash
aws ec2 describe-instances --filters Name=tag:Name,Values=openjii-serving-store-<env> \
  --query 'Reservations[].Instances[].[InstanceId,State.Name]' --output text
aws ec2 describe-instance-status --include-all-instances --instance-ids <instance-id>
```

A failed system status check is a problem with AWS's host. Simplified automatic recovery moves the
instance to another host by itself and reports `AWS_EC2_SIMPLIFIED_AUTO_RECOVERY_SUCCESS` or
`AWS_EC2_SIMPLIFIED_AUTO_RECOVERY_FAILURE` in the AWS Health Dashboard; it does not run during AWS
service events. If recovery failed or nothing happened, stop and start the instance. It keeps its
private address and its data volume.

A failed instance status check is the operating system. Read the console with
`aws ec2 get-console-output --instance-id <instance-id> --latest --output text`, which also works
when Session Manager cannot connect, then reboot the instance.

**2. Is ClickHouse running?** Open a session with `aws ssm start-session --target <instance-id>`:

```bash
systemctl status clickhouse-server
sudo journalctl -u clickhouse-server --since "1 hour ago"
sudo journalctl -k --since "1 hour ago" | grep -i "out of memory"
```

ClickHouse's error log is also in the CloudWatch log group `/aws/ec2/openjii-serving-store-<env>`,
stream `clickhouse-server.err.log`, which needs no session.

**3. Is the data volume mounted?** The service does not start without it.

```bash
findmnt /var/lib/clickhouse
```

Nothing mounted after a boot usually means the volume did not attach within the ten minutes systemd
waits for it. Check the attachment with
`aws ec2 describe-volumes --filters Name=tag:Name,Values=openjii-serving-store-<env>-data`, then run
`sudo systemctl start clickhouse-server`, which mounts the volume first.

**4. Does it answer on the instance?**

```bash
curl -s http://127.0.0.1/ping
curl -s http://127.0.0.1:9363/metrics | grep '^ClickHouseAsyncMetrics_Uptime '
```

`Ok.` from the first and an uptime line from the second, with the alert still firing, means the
agent is the break. Its errors are in `/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log`.

## Closing

Close once uptime datapoints arrive in `OpenJII/ServingStore` again, and name what stopped: the host,
the server, the mount or the agent.
