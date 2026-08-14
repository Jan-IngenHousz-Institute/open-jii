"use strict";

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const yaml = require("js-yaml");
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

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
  const raw = fs.readFileSync(path.join(__dirname, "catalog.yaml"), "utf8");
  return yaml.load(raw).metrics;
}

function resolvePlaceholders(value) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) => {
    const resolved = process.env[name];
    if (resolved === undefined || resolved === "") {
      throw new Error(`Unresolved catalog placeholder ${match}`);
    }
    return resolved;
  });
}

function toQuery(metric, index) {
  const id = `m${index}`;

  if (metric.signal.search) {
    return { Id: id, Expression: resolvePlaceholders(metric.signal.search), Period: 3600 };
  }

  const dimensions = Object.entries(metric.signal.dimensions ?? {}).map(([name, value]) => ({
    Name: name,
    Value: resolvePlaceholders(String(value)),
  }));

  return {
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: metric.signal.namespace,
        MetricName: metric.signal.metric,
        Dimensions: dimensions,
      },
      Period: 3600,
      Stat: metric.signal.stat,
    },
  };
}

function aggregate(values, stat) {
  if (values.length === 0) {
    return null;
  }

  if (stat === "Sum") {
    return values.reduce((total, value) => total + value, 0);
  }
  if (stat === "Maximum") {
    return Math.max(...values);
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

async function fetchWindow(metrics, start, end) {
  const byRegion = new Map();
  metrics.forEach((metric, index) => {
    const region = metric.signal.region ?? "default";
    if (!byRegion.has(region)) {
      byRegion.set(region, []);
    }
    byRegion.get(region).push({ metric, index });
  });

  const results = new Array(metrics.length).fill(null);

  for (const [region, entries] of byRegion) {
    const command = new GetMetricDataCommand({
      StartTime: start,
      EndTime: end,
      MetricDataQueries: entries.map(({ metric, index }) => toQuery(metric, index)),
    });
    const response = await cloudwatchFor(region === "default" ? undefined : region).send(command);

    // SEARCH queries return one series per matched metric, all sharing the query Id
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

  return results;
}

async function collect(metrics, now) {
  const current = await fetchWindow(metrics, new Date(now - DAY_MS), new Date(now));

  const baselines = [];
  for (const weeks of BASELINE_WEEKS) {
    const offset = weeks * WEEK_MS;
    baselines.push(
      await fetchWindow(metrics, new Date(now - DAY_MS - offset), new Date(now - offset)),
    );
  }

  return metrics.map((metric, index) => {
    const history = baselines.map((window) => window[index]).filter((value) => value !== null);
    const baseline =
      history.length > 0
        ? history.reduce((total, value) => total + value, 0) / history.length
        : null;
    return { metric, value: current[index], baseline, historyCount: history.length };
  });
}

function evaluate({ metric, value, baseline, historyCount }) {
  const rule = metric.baseline ?? {};

  const wentSilent = value === null && historyCount > 0;
  if (wentSilent) {
    return { state: "missing" };
  }
  if (value === null) {
    return { state: "no-data" };
  }

  if (rule.method === "threshold") {
    return value > rule.max
      ? { state: "anomaly", reason: `above threshold ${rule.max}` }
      : { state: "ok" };
  }
  if (rule.anomaly === "any-nonzero") {
    return value > 0 ? { state: "anomaly", reason: "nonzero" } : { state: "ok" };
  }
  if (typeof rule.anomaly_pct === "number" && baseline !== null && baseline > 0) {
    const deviation = ((value - baseline) / baseline) * 100;
    if (Math.abs(deviation) > rule.anomaly_pct) {
      return {
        state: "anomaly",
        reason: `${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% vs 4-week baseline`,
      };
    }
  }
  return { state: "ok" };
}

function formatValue(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function deltaGlyph(value, baseline) {
  if (baseline === null || baseline === 0) {
    return "";
  }
  const deviation = ((value - baseline) / baseline) * 100;
  const arrow = deviation > 5 ? "▲" : deviation < -5 ? "▼" : "▬";
  return ` ${arrow} ${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% vs 4w`;
}

function runbookLink(metric) {
  const base = process.env.RUNBOOK_BASE_URL;
  if (!base || !metric.runbook) {
    return "";
  }
  return ` · <${base}/${metric.runbook}|runbook>`;
}

function renderObservability(results, environment) {
  const anomalies = results.filter((entry) => entry.evaluation.state === "anomaly");
  const missing = results.filter((entry) => entry.evaluation.state === "missing");

  const lines = [];
  if (anomalies.length === 0) {
    lines.push(`🟢 *No anomalies* · ${results.length} signals checked (${environment})`);
  } else {
    lines.push(
      `🔴 *${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}* (${environment})`,
    );
    for (const entry of anomalies) {
      const context = JSON.stringify({
        id: entry.metric.id,
        value: entry.value,
        baseline: entry.baseline,
        reason: entry.evaluation.reason,
      });
      lines.push(
        `• *${entry.metric.name}*: ${formatValue(entry.value)} (${entry.evaluation.reason})` +
          `${runbookLink(entry.metric)} · \`claude /triage ${entry.metric.id}\`\n  \`${context}\``,
      );
    }
  }

  if (missing.length > 0) {
    const names = missing.map((entry) => entry.metric.id).join(", ");
    lines.push(
      `⚠️ Self-check: no datapoints for ${names} (had data in prior weeks); excluded above.`,
    );
  }

  return lines.join("\n");
}

function renderPulse(results, environment) {
  const lines = [`*Daily pulse* (${environment})`];
  for (const entry of results) {
    if (entry.value === null) {
      continue;
    }
    lines.push(
      `• ${entry.metric.name}: ${formatValue(entry.value)}${deltaGlyph(entry.value, entry.baseline)}`,
    );
  }
  return lines.length > 1 ? lines.join("\n") : `${lines[0]}\n• No usage signals active yet.`;
}

async function collectWeekly(metrics, now) {
  const current = await fetchWindow(metrics, new Date(now - WEEK_MS), new Date(now));
  const prior = await fetchWindow(metrics, new Date(now - 2 * WEEK_MS), new Date(now - WEEK_MS));
  return metrics.map((metric, index) => ({
    metric,
    value: current[index],
    baseline: prior[index],
    historyCount: prior[index] === null ? 0 : 1,
  }));
}

function renderWeekly(results, environment) {
  const lines = [`*Week in numbers* (${environment})`];
  for (const entry of results) {
    if (entry.value === null) {
      continue;
    }
    lines.push(
      `• ${entry.metric.name}: ${formatValue(entry.value)}${deltaGlyph(entry.value, entry.baseline)}`,
    );
  }
  lines.push(
    "_Sections pending collectors (rosters, product insights) are omitted until their phases land._",
  );
  return lines.join("\n");
}

function postToSlack(webhookUrl, text) {
  const payload = JSON.stringify({ text });

  return new Promise((resolve, reject) => {
    const request = https.request(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    });
    request.on("response", (response) => {
      if (response.statusCode && response.statusCode < 300) {
        response.resume();
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
  const webhooks = {
    heartbeat: process.env.HEARTBEAT_WEBHOOK_URL,
    usage: process.env.USAGE_WEBHOOK_URL,
  };
  const webhookUrl = webhooks[channel];

  if (!webhookUrl) {
    console.log(JSON.stringify({ channel, delivered: false, text }));
    return;
  }
  await postToSlack(webhookUrl, text);
  console.log(JSON.stringify({ channel, delivered: true }));
}

exports.handler = async (event) => {
  const digest = event?.digest;
  const environment = process.env.ENVIRONMENT ?? "unknown";
  const catalog = loadCatalog().filter((metric) => metric.active && metric.signal);
  const now = Date.now();

  if (digest === "observability") {
    const metrics = catalog.filter(
      (metric) =>
        metric.family === "observability" &&
        (metric.slots.includes("exception") || metric.slots.includes("alert")),
    );
    const results = (await collect(metrics, now)).map((entry) => ({
      ...entry,
      evaluation: evaluate(entry),
    }));
    await deliver("heartbeat", renderObservability(results, environment));
    return;
  }

  if (digest === "pulse") {
    const metrics = catalog.filter(
      (metric) => metric.family === "usage" && metric.slots.includes("pulse"),
    );
    const results = await collect(metrics, now);
    await deliver("usage", renderPulse(results, environment));
    return;
  }

  if (digest === "weekly") {
    const metrics = catalog.filter((metric) => metric.slots.includes("weekly"));
    const results = await collectWeekly(metrics, now);
    await deliver("usage", renderWeekly(results, environment));
    return;
  }

  throw new Error(`Unknown digest type: ${JSON.stringify(digest)}`);
};
