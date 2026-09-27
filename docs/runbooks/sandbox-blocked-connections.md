# sandbox-blocked-connections

**The sandboxes' network refused more than 100 connections in five minutes.** The sandboxes run
code researchers wrote, in subnets with no route to the internet. Their only permitted traffic is
HTTPS to the VPC endpoints for container images and CloudWatch Logs. Anything else is rejected and
recorded in the VPC flow log `/vpc/macro-sandbox-flow-logs-<env>`, and every rejected record counts
here.

The alert calls it a potential escape attempt. Most often it is a macro trying to reach the
internet, which it cannot.

## Read the rejected records

```bash
# On Linux, GNU date wants -d '1 hour ago' where BSD date wants -v-1H
aws logs filter-log-events --log-group-name /vpc/macro-sandbox-flow-logs-<env> \
  --filter-pattern REJECT --start-time $(( $(date -u -v-1H +%s) * 1000 )) \
  --max-items 50 --query 'events[].message' --output text
```

Each record names the network interface, the source and destination addresses and ports, and the
action. `aws ec2 describe-network-interfaces --network-interface-ids <eni>` says which function owns
an interface.

## What the destinations mean

- **Public addresses on 443 or 80.** A macro calling an external API or fetching a package. It
  fails inside the sandbox by design, so the macro's author needs telling, and nothing on the
  platform needs fixing.
- **Addresses inside the VPC.** Something probing its neighbours. That is the case to take
  seriously: find the macro from the interface and the time, and read its code.
- **A source that is not a sandbox.** The flow log covers the whole of the isolated subnets, which
  also hold the endpoints' interfaces. A client elsewhere in the VPC without permission to use
  those endpoints may be rejected there too, so check the source before blaming a macro.

## One count, two metrics

The calibration sandbox writes to the same flow log, and both metric filters
(`MacroSandboxRejectedTraffic-<env>` in `OpenJII/MacroSandbox` and
`CalibrationSandboxRejectedTraffic-<env>` in `OpenJII/CalibrationSandbox`) match every rejected
record in it. Both alert rules therefore fire together whichever sandbox caused it, and neither
metric says which. The report counts the first only.

## Closing

Note who made the connections and where to. A macro that keeps trying to reach the internet is
worth a word with its author.
