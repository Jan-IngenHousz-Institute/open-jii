"use strict";

const { Signer } = require("@aws-sdk/rds-signer");
const {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} = require("@aws-sdk/client-cloudwatch");
const postgres = require("postgres");

const cw = new CloudWatchClient({ region: process.env.AWS_RDS_REGION ?? "us-east-1" });

exports.handler = async () => {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT ?? "5432", 10);
  const database = process.env.DB_NAME;
  const username = process.env.DB_USER;
  const region = process.env.AWS_RDS_REGION;
  const namespace = process.env.CLOUDWATCH_NAMESPACE ?? "OpenJII/UserRegistrations";

  let password;
  if (process.env.DB_PASSWORD) {
    password = process.env.DB_PASSWORD;
  } else {
    const signer = new Signer({ hostname: host, port, region, username });
    password = await signer.getAuthToken();
  }

  const sql = postgres({
    host,
    port,
    database,
    username,
    password,
    ssl: process.env.DB_PASSWORD ? false : "require",
    max: 1,
  });

  try {
    // A row exists for every user an OTP request created, whether or not they ever
    // finished signing up, so an unfiltered count overstates the headcount.
    //
    // The window is exactly one ISO week, so an ungrouped count returns one row even
    // when nobody signed up. That zero is the point: without it a quiet week and a
    // publisher that never ran are both absence, and no reader can tell them apart.
    const [{ signups }] = await sql`
      SELECT COUNT(*)::int AS signups
      FROM users
      WHERE registered = true
        AND created_at >= date_trunc('week', now() - INTERVAL '7 days')
        AND created_at <  date_trunc('week', now())
    `;

    const environment = process.env.ENVIRONMENT ?? "unknown";
    // Every point carries an Environment dimension. Points published before this
    // change carry none, and CloudWatch treats those as a different series, so
    // history starts at the first run after deploy and the first week has nothing
    // to compare against. Dual-publishing the old undimensioned series would mean
    // guessing which environment wrote it, so it is deliberately not done.
    const dimensions = [{ Name: "Environment", Value: environment }];

    // Stamped at publish time, not at the start of the week being reported. A
    // backdated point falls outside a trailing seven-day window, which reads as a
    // week with no signups rather than as last week's count.
    const publishedAt = new Date();

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total FROM users WHERE registered = true
    `;

    // Over the same ISO week as the signups.
    const [{ created }] = await sql`
      SELECT COUNT(*)::int AS created
      FROM experiments
      WHERE created_at >= date_trunc('week', now() - INTERVAL '7 days')
        AND created_at <  date_trunc('week', now())
    `;

    // People, not exports, so a researcher who exports one table twenty times counts once. An
    // export's watchers asked for it while it ran and received it too. A completed export turns
    // expired later and a failed one carries completed_at as well, so the status decides.
    const [{ exported }] = await sql`
      SELECT COUNT(DISTINCT researcher)::int AS exported
      FROM experiment_exports, unnest(array_append(watcher_ids, created_by)) AS researcher
      WHERE status IN ('completed', 'expired')
        AND completed_at >= date_trunc('week', now() - INTERVAL '7 days')
        AND completed_at <  date_trunc('week', now())
    `;

    const [{ uploaded }] = await sql`
      SELECT COUNT(DISTINCT created_by)::int AS uploaded
      FROM experiment_uploads
      WHERE status = 'completed'
        AND completed_at >= date_trunc('week', now() - INTERVAL '7 days')
        AND completed_at <  date_trunc('week', now())
    `;

    const metricData = [
      { MetricName: "WeeklyNewUsers", Value: signups },
      { MetricName: "TotalUsers", Value: total },
      { MetricName: "WeeklyNewExperiments", Value: created },
      { MetricName: "WeeklyResearchersExported", Value: exported },
      { MetricName: "WeeklyResearchersUploaded", Value: uploaded },
    ].map((point) => ({
      ...point,
      Unit: StandardUnit.Count,
      Timestamp: publishedAt,
      Dimensions: dimensions,
    }));

    await cw.send(new PutMetricDataCommand({ Namespace: namespace, MetricData: metricData }));

    console.log(
      JSON.stringify({
        signups,
        totalUsers: total,
        experimentsCreated: created,
        researchersExported: exported,
        researchersUploaded: uploaded,
      }),
    );
  } finally {
    await sql.end();
  }
};
