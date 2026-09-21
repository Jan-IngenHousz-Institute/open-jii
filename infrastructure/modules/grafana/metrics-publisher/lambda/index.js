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
    const rows = await sql`
      SELECT
        EXTRACT(ISOYEAR FROM created_at)::int AS year,
        EXTRACT(WEEK FROM created_at)::int    AS week_number,
        COUNT(*)::int                         AS user_count
      FROM users
      WHERE registered = true
        AND created_at >= date_trunc('week', now() - INTERVAL '7 days')
        AND created_at <  date_trunc('week', now())
      GROUP BY year, week_number
      ORDER BY year, week_number
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
    // week with no signups rather than as last week's count.
    const publishedAt = new Date();

    // A week with no signups still publishes a zero. Without it, a quiet week and a
    // publisher that never ran are both absence, and the digest cannot tell them apart.
    const weeklyCounts = rows.length > 0 ? rows.map((row) => row.user_count) : [0];

    const metricData = weeklyCounts.map((count) => ({
      MetricName: "WeeklyNewUsers",
      Value: count,
      Unit: StandardUnit.Count,
      Timestamp: publishedAt,
      Dimensions: dimensions,
    }));

    const [{ total }] = await sql`
      SELECT COUNT(*)::int AS total FROM users WHERE registered = true
    `;
    metricData.push({
      MetricName: "TotalUsers",
      Value: total,
      Unit: StandardUnit.Count,
      Timestamp: publishedAt,
      Dimensions: dimensions,
    });

    const BATCH = 1000;
    for (let i = 0; i < metricData.length; i += BATCH) {
      await cw.send(
        new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: metricData.slice(i, i + BATCH),
        }),
      );
    }

    console.log(JSON.stringify({ weeksPublished: metricData.length - 1, totalUsers: total }));
  } finally {
    await sql.end();
  }
};
