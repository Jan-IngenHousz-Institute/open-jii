# database-connections

**More than 80 connections are open to the database, where normal is a handful.** Each backend
process holds exactly one connection (`max: 1` in `packages/database/src/database.ts`), so the API
accounts for one per task: one to three, and briefly up to six while a deploy runs old and new
tasks side by side. The migration task and the weekly metrics publisher add one each while they
run. The database's security group admits nothing else.

So 80 is not a capacity warning here. It means something is opening connections and not closing
them.

## Who holds them

Connection logging is on, so the cluster's PostgreSQL log in CloudWatch
(`/aws/rds/cluster/<cluster>/postgresql`) records every connection with its user and address. With
a database session:

```sql
SELECT usename, application_name, client_addr, state, count(*)
FROM pg_stat_activity
GROUP BY 1, 2, 3, 4
ORDER BY 5 DESC;
```

## Likely causes, most common first

- **A client created per request.** Code that builds its own `postgres` client instead of using the
  shared one opens a connection each time it runs. Compare the onset with recent deploys; the
  commit that added the import is usually the cause.
- **Tasks piling up.** A deploy stuck with new tasks failing and restarting keeps each one's
  connection open until it stops. The ECS service events show it, and `api-hosts-unhealthy` often
  fires alongside.

## Closing

Name the client that held them. Confirm the count is back to a handful.
