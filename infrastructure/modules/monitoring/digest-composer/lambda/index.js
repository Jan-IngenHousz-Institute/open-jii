"use strict";

// Handler only: AWS I/O and scheduling. All composition logic lives in
// @repo/monitoring, whose compiled output is copied to ./lib at build time.
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

const {
  activeSignals,
  buildQuery,
  parseCatalog,
  partitionByConfig,
  resolveForEnvironment,
} = require("./lib/catalog.js");
const { averageBaseline, evaluate } = require("./lib/baseline.js");
const { renderLevels, renderObservability } = require("./lib/render.js");
const {
  assembleWindow,
  dailyWindows,
  groupByRegion,
  incompleteSeries,
  mergeSeries,
  readSeries,
  weeklyWindows,
} = require("./lib/window.js");

// GetMetricData paginates. The digest asks for hourly points over at most a week, so one
// page is the norm; the cap only stops a malformed NextToken from looping forever.
const MAX_PAGES = 10;

const clients = new Map();

function cloudwatchFor(region) {
  const key = region ?? "default";
  if (!clients.has(key)) {
    clients.set(key, new CloudWatchClient(region ? { region } : {}));
  }
  return clients.get(key);
}

function loadCatalog() {
  return parseCatalog(fs.readFileSync(path.join(__dirname, "catalog.yaml"), "utf8"));
}

/**
 * Every page of one attempt, collected apart from the window so a throw part way through
 * discards what it read. Merging as it went would let the per-metric retry add a page the
 * failed batch had already counted, which for a Sum is a silently doubled total.
 */
async function readWindow(client, entries, { start, end }) {
  const values = new Map();
  const incomplete = new Set();
  let token;
  let pages = 0;

  do {
    const response = await client.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        MetricDataQueries: entries.map(({ metric, index }) =>
          buildQuery(metric, index, process.env),
        ),
        ...(token === undefined ? {} : { NextToken: token }),
      }),
    );

    readSeries(response.MetricDataResults, values);
    for (const index of incompleteSeries(response.MetricDataResults)) {
      incomplete.add(index);
    }

    token = response.NextToken;
    pages += 1;
  } while (token !== undefined && pages < MAX_PAGES);

  return { values, incomplete };
}

async function fetchWindow(metrics, timeWindow, failedRegions) {
  const values = new Map();
  const unqueried = new Set();

  for (const [region, entries] of groupByRegion(metrics)) {
    const client = cloudwatchFor(region === "default" ? undefined : region);

    // One region failing must not cost the whole digest. A rejected SEARCH
    // expression or a throttle would otherwise throw out of the handler and
    // deliver nothing, and nothing watches for the digest's own silence.
    let batch;
    try {
      batch = await readWindow(client, entries, timeWindow);
    } catch (error) {
      console.error(JSON.stringify({ region, message: error.message }));
    }

    if (batch !== undefined) {
      mergeSeries(values, batch.values);
      for (const index of batch.incomplete) {
        unqueried.add(index);
      }
      if (batch.incomplete.size > 0) {
        failedRegions.add(region === "default" ? (process.env.AWS_REGION ?? "default") : region);
      }
      continue;
    }

    // GetMetricData rejects the whole request over one bad expression, so without
    // this retry a single malformed entry costs every metric sharing its region.
    let lost = 0;
    for (const entry of entries) {
      try {
        const single = await readWindow(client, [entry], timeWindow);
        if (single.incomplete.size > 0) {
          unqueried.add(entry.index);
          lost += 1;
          continue;
        }
        mergeSeries(values, single.values);
      } catch (error) {
        console.error(JSON.stringify({ region, metric: entry.metric.id, message: error.message }));
        unqueried.add(entry.index);
        lost += 1;
      }
    }

    if (lost > 0) {
      failedRegions.add(region === "default" ? (process.env.AWS_REGION ?? "default") : region);
    }
  }

  return assembleWindow(metrics, values, unqueried);
}

async function collectDaily(metrics, now, failedRegions) {
  const { current: currentWindow, history: historyWindows } = dailyWindows(now);
  const current = await fetchWindow(metrics, currentWindow, failedRegions);

  const history = [];
  for (const past of historyWindows) {
    history.push(await fetchWindow(metrics, past, failedRegions));
  }

  return metrics.map((metric, index) => {
    const weekly = history.map((window) => window[index]);
    return {
      metric,
      value: current[index],
      baseline: averageBaseline(weekly),
      historyCount: weekly.filter((value) => value !== null).length,
    };
  });
}

async function collectWeekly(metrics, now, failedRegions) {
  const windows = weeklyWindows(now);
  const current = await fetchWindow(metrics, windows.current, failedRegions);
  const prior = await fetchWindow(metrics, windows.prior, failedRegions);

  return metrics.map((metric, index) => ({
    metric,
    value: current[index],
    baseline: prior[index],
    historyCount: prior[index] === null ? 0 : 1,
  }));
}

function post(url, body, headers = {}) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    });

    request.on("response", (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
      });
      response.on("end", () => {
        if (response.statusCode && response.statusCode < 300) {
          resolve(raw);
        } else {
          reject(new Error(`Slack returned ${response.statusCode}`));
        }
      });
    });

    // Node sets no socket timeout, so a hung Slack would otherwise burn the whole
    // Lambda timeout and lose the log line that says what went wrong.
    request.setTimeout(10_000, () => {
      request.destroy(new Error("Slack timed out after 10s"));
    });
    request.on("error", reject);
    request.end(payload);
  });
}

/**
 * A bot token buys threads; a webhook does not.
 *
 * An incoming webhook answers with the literal string "ok" and no message timestamp, so
 * there is nothing to reply to. chat.postMessage returns the ts, which is what lets the
 * detail for each anomaly hang under one summary instead of filling the channel.
 * Without a token the parent still posts, so the replies are additive.
 */
async function deliver(channel, digest) {
  const webhookUrl = {
    heartbeat: process.env.HEARTBEAT_WEBHOOK_URL,
    usage: process.env.USAGE_WEBHOOK_URL,
  }[channel];
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = {
    heartbeat: process.env.HEARTBEAT_CHANNEL_ID,
    usage: process.env.USAGE_CHANNEL_ID,
  }[channel];

  if (botToken && channelId) {
    const auth = { Authorization: `Bearer ${botToken}` };
    const parent = JSON.parse(
      await post(
        "https://slack.com/api/chat.postMessage",
        { channel: channelId, ...digest.parent },
        auth,
      ),
    );

    if (!parent.ok) {
      throw new Error(`chat.postMessage failed: ${parent.error}`);
    }

    for (const reply of digest.replies) {
      // One failed reply must not lose the summary that already landed.
      try {
        await post(
          "https://slack.com/api/chat.postMessage",
          { channel: channelId, thread_ts: parent.ts, ...reply },
          auth,
        );
      } catch (error) {
        console.error(JSON.stringify({ channel, reply: reply.text, message: error.message }));
      }
    }

    console.log(JSON.stringify({ channel, delivered: "thread", replies: digest.replies.length }));
    return;
  }

  if (!webhookUrl) {
    console.log(JSON.stringify({ channel, delivered: false, text: digest.parent.text }));
    return;
  }

  await post(webhookUrl, digest.parent);
  console.log(JSON.stringify({ channel, delivered: "webhook", replies: 0 }));
}

exports.handler = async (event) => {
  const digest = event?.digest;
  const region = process.env.AWS_REGION ?? "eu-central-1";
  const options = {
    environment: process.env.ENVIRONMENT ?? "unknown",
    runbookBaseUrl: process.env.RUNBOOK_BASE_URL,
    catalogUrl: process.env.CATALOG_URL,
    consoleUrl: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#metricsV2:`,
  };
  const now = Date.now();

  const selected = resolveForEnvironment(activeSignals(loadCatalog()), options.environment);
  const { usable, configErrors } = partitionByConfig(selected, process.env);
  if (configErrors.length > 0) {
    console.warn(JSON.stringify({ configErrors }));
  }

  const failedRegions = new Set();
  const selfChecks = () => ({ configErrors, failedRegions: [...failedRegions] });

  if (digest === "observability") {
    const metrics = usable.filter(
      (metric) =>
        metric.family === "observability" &&
        (metric.slots.includes("exception") || metric.slots.includes("alert")),
    );
    const readings = (await collectDaily(metrics, now, failedRegions)).map((reading) => ({
      ...reading,
      evaluation: evaluate(reading),
    }));

    await deliver("heartbeat", renderObservability(readings, selfChecks(), options));
    return;
  }

  if (digest === "pulse") {
    const metrics = usable.filter(
      (metric) => metric.family === "usage" && metric.slots.includes("pulse"),
    );
    const readings = await collectDaily(metrics, now, failedRegions);

    await deliver("usage", renderLevels(readings, selfChecks(), "Daily pulse", "4w", options));
    return;
  }

  if (digest === "weekly") {
    const metrics = usable.filter((metric) => metric.slots.includes("weekly"));
    const readings = await collectWeekly(metrics, now, failedRegions);

    await deliver(
      "usage",
      renderLevels(readings, selfChecks(), "Week in numbers", "last week", options),
    );
    return;
  }

  throw new Error(`Unknown digest type: ${JSON.stringify(digest)}`);
};
