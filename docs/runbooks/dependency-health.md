# dependency-health

**The backend cannot reach a service it depends on, or it has stopped checking.** Every five
minutes the backend checks the database, Databricks, the email server and AWS IoT, and publishes
`DependencyUp` to `OpenJII/Backend` for each `Dependency`: 1 when it reached the service, 0 when it
did not. The rule fires when one of them reads 0 for 15 minutes, or when nothing has been published
for 15 minutes. Unlike the 5xx rate, this works at a quiet hour, when nobody is making requests.

## Which service, and why

The entry's chart on the daily report draws one line per dependency. The backend logs every round
that found one down, with each check's reason:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '{ $.msg = "Dependencies unreachable" }'
```

| Dependency   | What the check does                                                 | What fails while it is down                                                |
| ------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `database`   | Asks AWS for the cluster's status. It never connects.               | Almost every request.                                                      |
| `databricks` | Lists one job with the backend's credentials.                       | Experiment data, exports, annotations, and anything else in the lakehouse. |
| `email`      | Logs in to the SMTP server with `EMAIL_SERVER` and sends nothing.   | Notification emails from the backend.                                      |
| `iot`        | Asks the AWS IoT API for the device data endpoint, without a cache. | Registering devices and handing a phone its broker address.                |

Sign-in codes and invitations go through the auth package's own `AUTH_EMAIL_SERVER`, so `email`
down does not prove they fail, and `email` up does not prove they work. The `iot` check reaches
the AWS IoT API, not the broker that phones publish to; the ingest rules watch that.

A check that takes longer than 10 seconds counts as down. `DependencyCheckMilliseconds` shows how
long each one took, so a service that is slow rather than gone shows there first.

## The database reads as paused

Dev and production pause the database after 30 idle minutes. A paused database counts as up and
`DependencyPaused` reads 1. Only a cluster status that cannot serve queries counts as down:

```bash
aws rds describe-db-clusters --db-cluster-identifier open-jii-<env>-db-cluster --query 'DBClusters[0].Status'
```

The check reads the status and the `ServerlessDatabaseCapacity` metric and never opens a
connection, because a connection every five minutes would keep the database from ever pausing.

## No data at all

An empty chart means the checks stopped, not the services. Either the backend is not running, and
`api-hosts-unhealthy` fires alongside, or it runs but cannot publish:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '{ $.errorCode = "DEPENDENCY_HEALTH_PUBLISH_FAILED" }'
```

A publish refused for permissions points at the task role's dependency health policy in
`infrastructure/modules/ecs/main.tf`. The checks run only in the deployed service, never locally.

## Closing

Do not close until every dependency has read 1 for 15 minutes.
