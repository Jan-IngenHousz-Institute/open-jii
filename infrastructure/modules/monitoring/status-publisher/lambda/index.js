"use strict";

// Handler only: AWS and HTTP I/O. What to read, what a healthy answer is, how readings become
// states, minutes and uptime, the published file and its caching, the Contentful query, when a
// failed read fails the run, and the events and their batches live in @repo/monitoring, copied to
// ./lib at build time.
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");
const { PublishBatchCommand, SNSClient } = require("@aws-sdk/client-sns");

const { statusQueries } = require("./lib/status-components.js");
const {
  STATUS_CONTENTFUL_ENVIRONMENT,
  STATUS_CONTENT_QUERY,
  parseStatusContentResponse,
  statusContentVariables,
  toStatusContent,
} = require("./lib/status-content.js");
const { STATUS_DOCUMENT_CACHE_CONTROL, statusDocumentSchema } = require("./lib/status-document.js");
const {
  batchEvents,
  failedEntriesText,
  statusEventSchema,
  statusEvents,
} = require("./lib/status-events.js");
const {
  STATUS_FEED_STATE_VERSION,
  contentFailure,
  isContentDue,
  statusFeedStateSchema,
} = require("./lib/status-feed.js");
const { judgeStatus, publisherStateSchema } = require("./lib/status-judge.js");
const { isApiHealthy, isWebsiteHealthy, websiteProbeUrl } = require("./lib/status-probes.js");
const { collapseReadings, unreadableResults } = require("./lib/status-readings.js");

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
const FEED_STATE_KEY = "status-feed.json";
const DOCUMENT_KEY = "data/status.json";
const MAX_LOGGED_ERROR_LENGTH = 500;

const s3 = new S3Client({ requestHandler: AWS_REQUEST_HANDLER });
const secrets = new SecretsManagerClient({ requestHandler: AWS_REQUEST_HANDLER });
const sns = new SNSClient({ requestHandler: AWS_REQUEST_HANDLER });
const cloudwatchByRegion = new Map();
// Kept for warm invocations, and dropped when a read fails so a rotated secret is picked up.
let contentfulCredentials;

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

async function readObjectText(bucket, key) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return await object.Body.transformToString();
  } catch (error) {
    // The first run has no state yet; anything else stops the run.
    if (error instanceof NoSuchKey) {
      return undefined;
    }
    throw error;
  }
}

// A state that no longer parses stops the run, so the error alert fires instead of history
// silently restarting.
async function readState(bucket, key, schema) {
  const text = await readObjectText(bucket, key);
  return text === undefined ? undefined : schema.parse(JSON.parse(text));
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

// The secret's text stays out of every message: a JSON.parse error quotes the text it choked on.
async function readContentfulCredentials(secretArn) {
  if (contentfulCredentials !== undefined) {
    return contentfulCredentials;
  }

  const { SecretString } = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));

  let secret;
  try {
    secret = JSON.parse(SecretString);
  } catch {
    throw new Error("The Contentful secret is not valid JSON");
  }

  const { CONTENTFUL_SPACE_ID: spaceId, CONTENTFUL_ACCESS_TOKEN: accessToken } = secret ?? {};
  if (!spaceId || !accessToken) {
    throw new Error("The Contentful secret lacks CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN");
  }

  contentfulCredentials = { spaceId, accessToken };
  return contentfulCredentials;
}

async function queryContentful(secretArn, now) {
  const { spaceId, accessToken } = await readContentfulCredentials(secretArn);
  const response = await fetch(
    `https://graphql.contentful.com/content/v1/spaces/${encodeURIComponent(spaceId)}/environments/${STATUS_CONTENTFUL_ENVIRONMENT}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "user-agent": "openjii-status-publisher",
      },
      body: JSON.stringify({
        query: STATUS_CONTENT_QUERY,
        variables: statusContentVariables(now),
      }),
    },
  );
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Contentful answered ${response.status}: ${body.slice(0, 200)}`);
  }

  return parseStatusContentResponse(JSON.parse(body));
}

// A Contentful outage must not stop the page, so a failed read is handed back for the caller to
// log and cover with the cached content.
async function readStatusContent(secretArn, now) {
  try {
    const { dropped, ...content } = toStatusContent(await queryContentful(secretArn, now));
    return { content, dropped };
  } catch (error) {
    contentfulCredentials = undefined;
    return { error };
  }
}

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_LOGGED_ERROR_LENGTH);
}

// Losing the feed state only restarts the baseline, so one that no longer parses is treated as
// absent and the page keeps updating.
async function readFeedState(bucket) {
  const text = await readObjectText(bucket, FEED_STATE_KEY);
  if (text === undefined) {
    return undefined;
  }

  try {
    return statusFeedStateSchema.parse(JSON.parse(text));
  } catch (error) {
    console.warn(
      JSON.stringify({ warning: "status-feed-unreadable", error: describeError(error) }),
    );
    return undefined;
  }
}

// The cached read decides whether Contentful is due, so it comes first.
async function readContent(stateBucket, secretArn, now) {
  const feed = await readFeedState(stateBucket);
  const contentRead = isContentDue(feed?.content, now)
    ? await readStatusContent(secretArn, now)
    : {};

  return { feed, contentRead };
}

async function publishEvents(topicArn, events) {
  for (const batch of batchEvents(events)) {
    const result = await sns.send(
      new PublishBatchCommand({
        TopicArn: topicArn,
        PublishBatchRequestEntries: batch.map(({ event, message }, index) => ({
          Id: String(index),
          Message: message,
          MessageAttributes: { type: { DataType: "String", StringValue: event.type } },
        })),
      }),
    );

    const failed = result.Failed ?? [];
    if (failed.length > 0) {
      const sent = batch.map(({ event }) => event);
      throw new Error(`SNS rejected status events: ${failedEntriesText(sent, failed)}`);
    }
  }
}

// Written last: a failed send leaves the old snapshot, so the same events come up again.
async function announceChanges({
  stateBucket,
  topicArn,
  feed,
  document,
  content,
  environment,
  pageUrl,
  now,
}) {
  const { events, announced } = statusEvents({
    previous: feed?.announced,
    document,
    environment,
    pageUrl,
    now,
  });

  await publishEvents(
    topicArn,
    events.map((statusEvent) => statusEventSchema.parse(statusEvent)),
  );

  const nextFeed = statusFeedStateSchema.parse({
    version: STATUS_FEED_STATE_VERSION,
    announced,
    content,
  });
  await writeJson(stateBucket, FEED_STATE_KEY, nextFeed, "no-store");

  return events.length;
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
  const contentfulSecretArn = required("STATUS_CONTENTFUL_SECRET_ARN");
  const eventsTopicArn = required("STATUS_EVENTS_TOPIC_ARN");
  const pageUrl = required("STATUS_PAGE_URL");

  // EventBridge delivers a scheduled event some seconds late; bucketing by the wall clock would
  // skip or repeat minutes.
  const now = event?.time ? new Date(event.time) : new Date();
  const [website, platform, previous, { feed, contentRead }, ...regions] = await Promise.all([
    probe(websiteProbeUrl(required("WEB_URL"), now), isWebsiteHealthy),
    probe(required("API_HEALTH_URL"), isApiHealthy),
    readState(stateBucket, STATE_KEY, publisherStateSchema),
    readContent(stateBucket, contentfulSecretArn, now),
    ...statusQueries(config).map((region) => regionReadings(region, now)),
  ]);

  const dropped = contentRead.dropped;
  const hasDropped = dropped !== undefined && dropped.incidents.length + dropped.notices.length > 0;
  if (hasDropped) {
    console.warn(JSON.stringify({ warning: "status-entry-dropped", ids: dropped }));
  }

  if (contentRead.error !== undefined) {
    console.warn(
      JSON.stringify({
        warning: "contentful-read-failed",
        error: describeError(contentRead.error),
        cachedAt: feed?.content?.fetchedAt ?? null,
      }),
    );
  }

  const freshContent = contentRead.content && {
    fetchedAt: now.toISOString(),
    ...contentRead.content,
  };
  const content = freshContent ?? feed?.content;

  const { document, state } = judgeStatus({
    now,
    probes: { website, platform },
    readings: Object.assign({}, ...regions),
    previous,
    incidents: content?.incidents ?? [],
    notices: content?.notices ?? [],
  });

  const validDocument = statusDocumentSchema.parse(document);

  await writeJson(stateBucket, STATE_KEY, state, "no-store");
  await writeJson(siteBucket, DOCUMENT_KEY, validDocument, STATUS_DOCUMENT_CACHE_CONTROL);

  // Before any content has been read, a baseline would hold no incidents and the first good read
  // would announce every open one at once, so announcing waits for content.
  const eventCount =
    content === undefined
      ? 0
      : await announceChanges({
          stateBucket,
          topicArn: eventsTopicArn,
          feed,
          document: validDocument,
          content,
          environment: config.environment,
          pageUrl,
          now,
        });

  console.log(
    JSON.stringify({
      components: Object.fromEntries(document.components.map(({ id, state }) => [id, state])),
      probes: { website, platform },
      events: eventCount,
    }),
  );

  const cause = contentRead.error === undefined ? undefined : describeError(contentRead.error);
  const failure = contentFailure(cause, feed?.content, now);
  if (failure !== undefined) {
    throw new Error(failure);
  }
};
