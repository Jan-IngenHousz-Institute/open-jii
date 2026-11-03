"use strict";

// Handler only: AWS and HTTP I/O. What to read, how readings become states, minutes and uptime,
// and the shape of the published file live in @repo/monitoring, copied to ./lib at build time.
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const { statusQueries } = require("./lib/status-components.js");
const { statusDocumentSchema } = require("./lib/status-document.js");
const { judgeStatus, publisherStateSchema } = require("./lib/status-judge.js");
const { collapseReadings } = require("./lib/status-readings.js");

const MINUTE_MS = 60_000;
// Under the function's 50 s timeout with both probes and every metric read in flight together.
const PROBE_TIMEOUT_MS = 10_000;
// Without throwOnRequestTimeout the SDK only logs a request that outlives its timeout.
const AWS_REQUEST_HANDLER = {
  requestTimeout: 10_000,
  connectionTimeout: 5_000,
  throwOnRequestTimeout: true,
};
const STATE_KEY = "publisher-state.json";
const DOCUMENT_KEY = "data/status.json";
// The page polls every minute; CloudFront otherwise keeps an object without this for a day.
// stale-if-error lets CloudFront keep serving the last file through an origin outage.
const DOCUMENT_CACHE_CONTROL = "public, max-age=30, stale-if-error=86400";
const UNREADABLE_STATUS_CODES = new Set(["Forbidden", "InternalError"]);

const s3 = new S3Client({ requestHandler: AWS_REQUEST_HANDLER });
const cloudwatchByRegion = new Map();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function cloudwatch(region) {
  if (!cloudwatchByRegion.has(region)) {
    cloudwatchByRegion.set(
      region,
      new CloudWatchClient({ region, requestHandler: AWS_REQUEST_HANDLER }),
    );
  }
  return cloudwatchByRegion.get(region);
}

async function probe(url, isHealthy) {
  const started = Date.now();

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { "user-agent": "openjii-status-publisher" },
    });
    const body = await response.text();
    return { ok: response.ok && isHealthy(body), durationMs: Date.now() - started };
  } catch {
    return { ok: false, durationMs: Date.now() - started };
  }
}

// A page that renders the product's name is up; an empty 200 from a broken deploy is not.
const isWebsiteHealthy = (body) => body.includes("openJII");

function isApiHealthy(body) {
  try {
    return JSON.parse(body).status === "ok";
  } catch {
    return false;
  }
}

// A result CloudWatch could not answer reads as no datapoints, which the judge takes for a quiet
// signal or a silent producer, so it has to stop the run instead. PartialData only means more
// pages follow until the last one.
function unreadableResults(page) {
  const isLastPage = !page.NextToken;

  return (page.MetricDataResults ?? []).filter(
    ({ StatusCode }) =>
      UNREADABLE_STATUS_CODES.has(StatusCode) || (isLastPage && StatusCode === "PartialData"),
  );
}

function describeUnreadable({ Id, StatusCode, Messages }) {
  const messages = (Messages ?? []).map(({ Code, Value }) => `${Code}: ${Value}`).join("; ");
  return `${Id} (${StatusCode}${messages ? `, ${messages}` : ""})`;
}

async function regionReadings({ region, queries, lookbackMinutes, readings }, now) {
  const results = [];
  const unreadable = [];
  let token;

  do {
    const page = await cloudwatch(region).send(
      new GetMetricDataCommand({
        MetricDataQueries: queries,
        StartTime: new Date(
          Math.floor((now.getTime() - lookbackMinutes * MINUTE_MS) / MINUTE_MS) * MINUTE_MS,
        ),
        EndTime: now,
        NextToken: token,
      }),
    );
    results.push(...(page.MetricDataResults ?? []));
    unreadable.push(...unreadableResults(page));
    token = page.NextToken;
  } while (token);

  if (unreadable.length > 0) {
    throw new Error(
      `GetMetricData in ${region} could not read: ${unreadable.map(describeUnreadable).join(", ")}`,
    );
  }

  return collapseReadings(readings, results, now);
}

async function readState(bucket) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: STATE_KEY }));
    return publisherStateSchema.parse(JSON.parse(await object.Body.transformToString()));
  } catch (error) {
    // The first run has no state yet; anything else, including a state that no longer parses,
    // stops the run so the error alert fires instead of history silently restarting.
    if (error instanceof NoSuchKey) {
      return undefined;
    }
    throw error;
  }
}

async function writeJson(bucket, key, value, cacheControl) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
      ContentType: "application/json",
      CacheControl: cacheControl,
    }),
  );
}

exports.handler = async (event) => {
  const config = {
    environment: required("ENVIRONMENT"),
    albArnSuffix: required("ALB_ARN_SUFFIX"),
    webDistributionId: required("WEB_DISTRIBUTION_ID"),
    kinesisStreamName: required("KINESIS_STREAM_NAME"),
  };
  const siteBucket = required("SITE_BUCKET");
  const stateBucket = required("STATE_BUCKET");

  // EventBridge delivers a scheduled event some seconds late; bucketing by the wall clock would
  // skip or repeat minutes.
  const now = event?.time ? new Date(event.time) : new Date();
  const [website, platform, previous, ...regions] = await Promise.all([
    probe(required("WEB_URL"), isWebsiteHealthy),
    probe(required("API_HEALTH_URL"), isApiHealthy),
    readState(stateBucket),
    ...statusQueries(config).map((region) => regionReadings(region, now)),
  ]);

  const { document, state } = judgeStatus({
    now,
    probes: { website, platform },
    readings: Object.assign({}, ...regions),
    previous,
    incidents: [],
  });

  const validDocument = statusDocumentSchema.parse(document);

  await writeJson(stateBucket, STATE_KEY, state, "no-store");
  await writeJson(siteBucket, DOCUMENT_KEY, validDocument, DOCUMENT_CACHE_CONTROL);

  console.log(
    JSON.stringify({
      components: Object.fromEntries(document.components.map(({ id, state }) => [id, state])),
      probes: { website, platform },
    }),
  );
};
