"use strict";

// Handler only: AWS I/O and scheduling. All composition logic lives in
// @repo/monitoring, whose compiled output is copied to ./lib at build time.
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

const { activeSignals, buildQuery, parseCatalog, partitionByConfig } = require("./lib/catalog.js");
const { averageBaseline, evaluate } = require("./lib/baseline.js");
const { renderLevels, renderObservability } = require("./lib/render.js");
const {
  assembleWindow,
  dailyWindows,
  groupByRegion,
  readSeries,
  weeklyWindows,
} = require("./lib/window.js");

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

function queryWindow(client, entries, { start, end }) {
  return client.send(
    new GetMetricDataCommand({
      StartTime: start,
      EndTime: end,
      MetricDataQueries: entries.map(({ metric, index }) => buildQuery(metric, index, process.env)),
    }),
  );
}

async function fetchWindow(metrics, timeWindow, failedRegions) {
  const values = new Map();
  const unqueried = new Set();

  for (const [region, entries] of groupByRegion(metrics)) {
    const client = cloudwatchFor(region === "default" ? undefined : region);

    // One region failing must not cost the whole digest. A rejected SEARCH
    // expression or a throttle would otherwise throw out of the handler and
    // deliver nothing, and nothing watches for the digest's own silence.
    try {
      readSeries((await queryWindow(client, entries, timeWindow)).MetricDataResults, values);
      continue;
    } catch (error) {
      console.error(JSON.stringify({ region, message: error.message }));
    }

    // GetMetricData rejects the whole request over one bad expression, so without
    // this retry a single malformed entry costs every metric sharing its region.
    let lost = 0;
    for (const entry of entries) {
      try {
        readSeries((await queryWindow(client, [entry], timeWindow)).MetricDataResults, values);
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

function postToSlack(webhookUrl, text) {
  const payload = JSON.stringify({ text });

  return new Promise((resolve, reject) => {
    const request = https.request(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    });
    request.on("response", (response) => {
      response.resume();
      if (response.statusCode && response.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Slack webhook returned ${response.statusCode}`));
      }
    });
    // Node sets no socket timeout, so a hung webhook would otherwise burn the whole
    // Lambda timeout and lose the log line that says what went wrong.
    request.setTimeout(10_000, () => {
      request.destroy(new Error("Slack webhook timed out after 10s"));
    });
    request.on("error", reject);
    request.end(payload);
  });
}

async function deliver(channel, text) {
  const webhookUrl = {
    heartbeat: process.env.HEARTBEAT_WEBHOOK_URL,
    usage: process.env.USAGE_WEBHOOK_URL,
  }[channel];

  if (!webhookUrl) {
    console.log(JSON.stringify({ channel, delivered: false, text }));
    return;
  }

  await postToSlack(webhookUrl, text);
  console.log(JSON.stringify({ channel, delivered: true }));
}

exports.handler = async (event) => {
  const digest = event?.digest;
  const options = {
    environment: process.env.ENVIRONMENT ?? "unknown",
    runbookBaseUrl: process.env.RUNBOOK_BASE_URL,
  };
  const now = Date.now();

  const { usable, configErrors } = partitionByConfig(activeSignals(loadCatalog()), process.env);
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
