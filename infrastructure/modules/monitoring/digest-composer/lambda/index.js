"use strict";

// Handler only: AWS I/O and scheduling. All composition logic lives in
// @repo/monitoring, whose compiled output is copied to ./lib at build time.
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

const { activeSignals, buildQuery, parseCatalog, partitionByConfig } = require("./lib/catalog.js");
const { aggregate, averageBaseline, evaluate, normalizeAbsent } = require("./lib/baseline.js");
const { renderLevels, renderObservability } = require("./lib/render.js");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const BASELINE_WEEKS = [1, 2, 3, 4];

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

async function fetchWindow(metrics, start, end, failedRegions) {
  const byRegion = new Map();
  metrics.forEach((metric, index) => {
    const region = metric.signal.region ?? "default";
    const entries = byRegion.get(region) ?? [];
    entries.push({ metric, index });
    byRegion.set(region, entries);
  });

  const results = new Array(metrics.length).fill(null);

  for (const [region, entries] of byRegion) {
    let response;

    // One region failing must not cost the whole digest. A rejected SEARCH
    // expression or a throttle would otherwise throw out of the handler and
    // deliver nothing, and nothing watches for the digest's own silence.
    try {
      response = await cloudwatchFor(region === "default" ? undefined : region).send(
        new GetMetricDataCommand({
          StartTime: start,
          EndTime: end,
          MetricDataQueries: entries.map(({ metric, index }) =>
            buildQuery(metric, index, process.env),
          ),
        }),
      );
    } catch (error) {
      console.error(JSON.stringify({ region, message: error.message }));
      failedRegions.add(region === "default" ? (process.env.AWS_REGION ?? "default") : region);
      continue;
    }

    // A SEARCH query returns one series per matched metric, all sharing its Id
    const valuesByIndex = new Map();
    for (const series of response.MetricDataResults ?? []) {
      const index = Number(series.Id.slice(1));
      const bucket = valuesByIndex.get(index) ?? [];
      bucket.push(...(series.Values ?? []));
      valuesByIndex.set(index, bucket);
    }

    for (const [index, values] of valuesByIndex) {
      results[index] = aggregate(values, metrics[index].signal.stat);
    }
  }

  return results.map((value, index) => normalizeAbsent(value, metrics[index].signal.stat));
}

async function collectDaily(metrics, now, failedRegions) {
  const current = await fetchWindow(metrics, new Date(now - DAY_MS), new Date(now), failedRegions);

  const history = [];
  for (const weeks of BASELINE_WEEKS) {
    const offset = weeks * WEEK_MS;
    history.push(
      await fetchWindow(
        metrics,
        new Date(now - DAY_MS - offset),
        new Date(now - offset),
        failedRegions,
      ),
    );
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
  const current = await fetchWindow(metrics, new Date(now - WEEK_MS), new Date(now), failedRegions);
  const prior = await fetchWindow(
    metrics,
    new Date(now - 2 * WEEK_MS),
    new Date(now - WEEK_MS),
    failedRegions,
  );

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

    const selfChecks = { configErrors, failedRegions: [...failedRegions] };
    await deliver("heartbeat", renderObservability(readings, selfChecks, options));
    return;
  }

  if (digest === "pulse") {
    const metrics = usable.filter(
      (metric) => metric.family === "usage" && metric.slots.includes("pulse"),
    );

    await deliver(
      "usage",
      renderLevels(await collectDaily(metrics, now, failedRegions), "Daily pulse", "4w", options),
    );
    return;
  }

  if (digest === "weekly") {
    const metrics = usable.filter((metric) => metric.slots.includes("weekly"));

    await deliver(
      "usage",
      renderLevels(
        await collectWeekly(metrics, now, failedRegions),
        "Week in numbers",
        "last week",
        options,
      ),
    );
    return;
  }

  throw new Error(`Unknown digest type: ${JSON.stringify(digest)}`);
};
