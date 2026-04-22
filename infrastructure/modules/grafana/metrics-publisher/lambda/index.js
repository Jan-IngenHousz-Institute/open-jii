"use strict";

const { Signer } = require("@aws-sdk/rds-signer");
const { CloudWatchClient, PutMetricDataCommand, StandardUnit } = require("@aws-sdk/client-cloudwatch");
const postgres = require("postgres");

const cw = new CloudWatchClient({ region: process.env.AWS_RDS_REGION ?? "us-east-1" });

// Returns the UTC timestamp of Monday 00:00:00 for the given ISO year + week number.
function isoWeekStart(year, week) {
    // Jan 4 is always in ISO week 1
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // 1 = Mon … 7 = Sun
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
    const result = new Date(week1Monday);
    result.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    return result;
}

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
        const rows = await sql`
      SELECT
        EXTRACT(ISOYEAR FROM created_at)::int AS year,
        EXTRACT(WEEK FROM created_at)::int    AS week_number,
        COUNT(*)::int                         AS user_count
      FROM users
      GROUP BY year, week_number
      ORDER BY year, week_number
    `;

        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

        const metricData = rows
            .map((row) => ({
                timestamp: isoWeekStart(row.year, row.week_number),
                count: row.user_count,
            }))
            .filter(({ timestamp }) => timestamp >= cutoff)
            .map(({ timestamp, count }) => ({
                MetricName: "WeeklyNewUsers",
                Value: count,
                Unit: StandardUnit.Count,
                Timestamp: timestamp,
            }));

        const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM users`;
        metricData.push({
            MetricName: "TotalUsers",
            Value: total,
            Unit: StandardUnit.Count,
            Timestamp: new Date(),
        });

        const BATCH = 1000;
        for (let i = 0; i < metricData.length; i += BATCH) {
            await cw.send(
                new PutMetricDataCommand({
                    Namespace: namespace,
                    MetricData: metricData.slice(i, i + BATCH),
                })
            );
        }

        console.log(JSON.stringify({ weeksPublished: metricData.length - 1, totalUsers: total }));
    } finally {
        await sql.end();
    }
};
