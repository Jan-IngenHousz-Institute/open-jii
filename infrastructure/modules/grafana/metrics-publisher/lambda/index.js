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
    // publisher that never ran are both absence, and the digest cannot tell them apart.
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
    // backdated point falls outside the digest's trailing window, which reads as a
    // week with no signups rather than as last week's count. This is why the weekly
    // digest is scheduled after this job rather than before it.
    const publishedAt = new Date();

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total FROM users WHERE registered = true
    `;

    const metricData = [
      { MetricName: "WeeklyNewUsers", Value: signups },
      { MetricName: "TotalUsers", Value: total },
    ].map((point) => ({
      ...point,
      Unit: StandardUnit.Count,
      Timestamp: publishedAt,
      Dimensions: dimensions,
    }));

    await cw.send(new PutMetricDataCommand({ Namespace: namespace, MetricData: metricData }));

    console.log(JSON.stringify({ signups, totalUsers: total }));
  } finally {
    await sql.end();
  }
};
