import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { pathFromRoot, repositoryRoot } from "../lib/config.js";
import {
  parseGrafanaEnvironment,
  requireGrafanaClient,
  rulesOf,
  rulesPath,
} from "../lib/grafana.js";
import type {
  GrafanaClient,
  GrafanaEnvironment,
  GrafanaQueryRequest,
  GrafanaRule,
} from "../lib/grafana.js";

const hour = 3_600_000;
const day = 24 * hour;

export interface RoundWindow {
  from: Date;
  to: Date;
}

// A Monday's round covers the weekend.
export function defaultWindow(now: Date): RoundWindow {
  const hours = now.getDay() === 1 ? 72 : 24;
  return { from: new Date(now.getTime() - hours * hour), to: now };
}

export interface ReadArgs {
  environment: GrafanaEnvironment;
  since: Date | null;
  panels: number[] | null;
  output: string;
}

function optionAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv: string[]): ReadArgs {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const environment = parseGrafanaEnvironment(args.at(0));
  const since = optionAfter(args, "--since");
  const sinceDate = since === null ? null : new Date(since);
  if (sinceDate !== null && Number.isNaN(sinceDate.getTime())) {
    throw new Error("--since takes a date or a time, for example 2026-09-25 or 2026-09-25T09:00");
  }
  const panels = optionAfter(args, "--panels");
  const panelIds = panels === null ? null : panels.split(",").map(Number);
  if (panelIds?.some((id) => !Number.isInteger(id))) {
    throw new Error("--panels takes panel ids separated by commas, for example 89,91");
  }
  return {
    environment,
    since: sinceDate,
    panels: panelIds,
    output: optionAfter(args, "--output") ?? `.claude/round/${environment}.json`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isoOf(time: number): string {
  return new Date(time).toISOString().replace(/\.000Z$/, "Z");
}

export interface StateChange {
  time: string;
  rule: string | null;
  from: string;
  to: string;
}

// Grafana records an alert rule's state changes as annotations. Their text opens with the rule's
// name, which is the only link back to the rule that every version fills in.
export function changesOf(body: unknown, rules: GrafanaRule[]): StateChange[] {
  const names = rules.map((rule) => rule.name).sort((a, b) => b.length - a.length);
  return recordsOf(body)
    .flatMap((annotation): StateChange[] => {
      if (typeof annotation.time !== "number") return [];
      const text = textOf(annotation.text);
      const alertName = textOf(annotation.alertName);
      return [
        {
          time: isoOf(annotation.time),
          rule: names.find((name) => name === alertName || text.startsWith(name)) ?? null,
          from: textOf(annotation.prevState),
          to: textOf(annotation.newState),
        },
      ];
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

export interface Delta {
  new: string[];
  continuing: { rule: string; days: number | null }[];
  cleared: string[];
}

export function deltaOf(rules: GrafanaRule[], changes: StateChange[], window: RoundWindow): Delta {
  const firing = rules.filter((rule) => rule.state === "firing");
  const startedInWindow = (rule: GrafanaRule) =>
    rule.activeSince !== null && Date.parse(rule.activeSince) >= window.from.getTime();
  const firingNames = new Set(firing.map((rule) => rule.name));
  const touchedAlerting = changes.flatMap((change) =>
    change.rule !== null && [change.from, change.to].some((state) => state.startsWith("Alerting"))
      ? [change.rule]
      : [],
  );

  return {
    new: firing.filter(startedInWindow).map((rule) => rule.name),
    continuing: firing
      .filter((rule) => !startedInWindow(rule))
      .map((rule) => ({
        rule: rule.name,
        days:
          rule.activeSince === null
            ? null
            : Math.floor((window.to.getTime() - Date.parse(rule.activeSince)) / day),
      })),
    cleared: [...new Set(touchedAlerting)].filter((name) => !firingNames.has(name)),
  };
}

export function panelsToRead(dashboard: unknown, ids: number[] | null): Record<string, unknown>[] {
  const model = isRecord(dashboard) && isRecord(dashboard.dashboard) ? dashboard.dashboard : {};
  const top = recordsOf(model.panels);
  // A collapsed row nests its panels, and the report shows them only when opened.
  const everyPanel = top.flatMap((panel) => [panel, ...recordsOf(panel.panels)]);
  const chosen = ids === null ? top : everyPanel.filter((panel) => ids.includes(Number(panel.id)));
  return chosen.filter((panel) => recordsOf(panel.targets).length > 0);
}

// The browser fills these before a query leaves it; the query endpoint takes the text as it is.
function fillTimeMacros(value: unknown, range: RoundWindow): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{__(from|to)(:date:iso)?\}/g, (_match, edge: string, iso?: string) => {
      const time = edge === "from" ? range.from : range.to;
      return iso ? time.toISOString() : String(time.getTime());
    });
  }
  if (Array.isArray(value)) return value.map((item) => fillTimeMacros(item, range));
  if (isRecord(value)) return fillRecord(value, range);
  return value;
}

function fillRecord(record: Record<string, unknown>, range: RoundWindow): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, fillTimeMacros(value, range)]),
  );
}

const timeUnits: Partial<Record<string, number>> = { m: 60_000, h: hour, d: day };

// A panel may pin its own range, such as the last three days of a log group.
function panelRange(panel: Record<string, unknown>, window: RoundWindow): RoundWindow {
  const match = typeof panel.timeFrom === "string" ? /^(\d+)([mhd])$/.exec(panel.timeFrom) : null;
  const unit = timeUnits[match?.[2] ?? ""];
  if (match === null || unit === undefined) return window;
  return { from: new Date(window.to.getTime() - Number(match[1]) * unit), to: window.to };
}

export function panelQuery(
  panel: Record<string, unknown>,
  window: RoundWindow,
): GrafanaQueryRequest {
  const range = panelRange(panel, window);
  return {
    from: String(range.from.getTime()),
    to: String(range.to.getTime()),
    queries: recordsOf(panel.targets)
      .filter((target) => target.hide !== true)
      .map((target) => ({
        ...fillRecord(target, range),
        datasource: target.datasource ?? panel.datasource,
        intervalMs: 300_000,
        maxDataPoints: 1000,
      })),
  };
}

interface Step {
  color: string;
  value: number | null;
}

function stepsOf(thresholds: unknown): Step[] {
  const steps = isRecord(thresholds) ? recordsOf(thresholds.steps) : [];
  return steps.map((step) => ({
    color: textOf(step.color),
    value: typeof step.value === "number" ? step.value : null,
  }));
}

function overrideFor(panel: Record<string, unknown>, refId: string, property: string): unknown {
  const fieldConfig = isRecord(panel.fieldConfig) ? panel.fieldConfig : {};
  for (const override of recordsOf(fieldConfig.overrides)) {
    const matcher = isRecord(override.matcher) ? override.matcher : {};
    if (matcher.id !== "byFrameRefID" || matcher.options !== refId) continue;
    const found = recordsOf(override.properties).find((entry) => entry.id === property);
    if (found !== undefined) return found.value;
  }
  return undefined;
}

function defaultThresholds(panel: Record<string, unknown>): unknown {
  const fieldConfig = isRecord(panel.fieldConfig) ? panel.fieldConfig : {};
  return isRecord(fieldConfig.defaults) ? fieldConfig.defaults.thresholds : undefined;
}

// Grafana colours a reading by the highest step at or below it, the first step being the floor.
function colourOf(steps: Step[], reading: number): string {
  let colour = steps[0]?.color ?? "";
  for (const step of steps) {
    if (step.value !== null && reading >= step.value) colour = step.color;
  }
  return colour;
}

export interface RedStretch {
  from: string;
  to: string;
  worst: number;
}

type Row = [number, number | null];

// A missing reading ends a stretch, as a gap does on the board.
function redStretches(rows: Row[], steps: Step[]): RedStretch[] {
  if (!steps.some((step) => step.color === "red")) return [];
  // With red as the floor colour, a low reading is the bad one.
  const lowIsBad = steps[0]?.color === "red";
  const stretches: RedStretch[] = [];
  let open: { from: number; to: number; worst: number } | null = null;

  for (const [time, reading] of rows) {
    const isRed = reading !== null && colourOf(steps, reading) === "red";
    if (isRed && open !== null) {
      open.to = time;
      open.worst = lowIsBad ? Math.min(open.worst, reading) : Math.max(open.worst, reading);
    } else if (isRed) {
      open = { from: time, to: time, worst: reading };
    } else if (open !== null) {
      stretches.push({ from: isoOf(open.from), to: isoOf(open.to), worst: open.worst });
      open = null;
    }
  }
  if (open !== null)
    stretches.push({ from: isoOf(open.from), to: isoOf(open.to), worst: open.worst });
  return stretches;
}

export interface Series {
  refId: string;
  name: string;
  readings: number;
  firstAt: string | null;
  lastAt: string | null;
  min: number | null;
  max: number | null;
  last: number | null;
  sum: number | null;
  red: RedStretch[];
  points?: [string, number][];
}

export interface Table {
  refId: string;
  columns: string[];
  rows: unknown[][];
}

export interface PanelReading {
  id: number;
  title: string;
  type: string;
  errors: string[];
  series: Series[];
  tables: Table[];
}

function seriesName(field: Record<string, unknown>, frame: Record<string, unknown>): string {
  const config = isRecord(field.config) ? field.config : {};
  if (typeof config.displayNameFromDS === "string") return config.displayNameFromDS;
  const labels = isRecord(field.labels) ? Object.values(field.labels).map(String) : [];
  if (labels.length > 0) return labels.join(" ");
  const schema = isRecord(frame.schema) ? frame.schema : {};
  return typeof schema.name === "string" && schema.name.length > 0
    ? schema.name
    : textOf(field.name);
}

function summarise(
  refId: string,
  name: string,
  rows: Row[],
  steps: Step[],
  withPoints: boolean,
): Series {
  const points = rows.flatMap(([time, reading]): [number, number][] =>
    reading === null ? [] : [[time, reading]],
  );
  const readings = points.map(([, reading]) => reading);
  const first = points.at(0);
  const final = points.at(-1);
  return {
    refId,
    name,
    readings: points.length,
    firstAt: first === undefined ? null : isoOf(first[0]),
    lastAt: final === undefined ? null : isoOf(final[0]),
    min: readings.length === 0 ? null : Math.min(...readings),
    max: readings.length === 0 ? null : Math.max(...readings),
    last: final === undefined ? null : final[1],
    sum: readings.length === 0 ? null : readings.reduce((total, reading) => total + reading, 0),
    red: redStretches(rows, steps),
    ...(withPoints ? { points: points.map(([time, reading]) => [isoOf(time), reading]) } : {}),
  };
}

// A chart's shape matters, so it keeps its points; a board row or a tile is read by its summary.
export function readingOf(panel: Record<string, unknown>, body: unknown): PanelReading {
  const reading: PanelReading = {
    id: Number(panel.id),
    title: textOf(panel.title),
    type: textOf(panel.type),
    errors: [],
    series: [],
    tables: [],
  };
  const withPoints = reading.type === "timeseries";
  const results = isRecord(body) && isRecord(body.results) ? body.results : {};

  for (const [refId, result] of Object.entries(results)) {
    if (!isRecord(result)) continue;
    if (typeof result.error === "string") reading.errors.push(`${refId}: ${result.error}`);

    for (const frame of recordsOf(result.frames)) {
      const schema = isRecord(frame.schema) ? frame.schema : {};
      const fields = recordsOf(schema.fields);
      const columns = listOf(isRecord(frame.data) ? frame.data.values : undefined).map(listOf);
      const timeIndex = fields.findIndex((field) => field.type === "time");

      if (timeIndex < 0) {
        const rowCount = Math.max(0, ...columns.map((column) => column.length));
        reading.tables.push({
          refId,
          columns: fields.map((field) => textOf(field.name)),
          rows: Array.from({ length: rowCount }, (_, row) =>
            columns.map((column) => column.at(row)),
          ),
        });
        continue;
      }

      const times = columns.at(timeIndex) ?? [];
      const override = overrideFor(panel, refId, "displayName");
      const steps = stepsOf(overrideFor(panel, refId, "thresholds") ?? defaultThresholds(panel));
      fields.forEach((field, index) => {
        if (field.type !== "number") return;
        const values = columns.at(index) ?? [];
        const rows = times.flatMap((time, row): Row[] => {
          const value = values[row];
          return typeof time === "number" ? [[time, typeof value === "number" ? value : null]] : [];
        });
        const name = typeof override === "string" ? override : seriesName(field, frame);
        reading.series.push(summarise(refId, name, rows, steps, withPoints));
      });
    }
  }
  return reading;
}

export interface Round {
  environment: GrafanaEnvironment;
  window: { from: string; to: string };
  // What could not be read, which the round reports rather than reading past.
  unavailable: string[];
  rules: GrafanaRule[];
  delta: Delta;
  changes: StateChange[];
  panels: PanelReading[];
}

function failureOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readRound(
  client: GrafanaClient,
  environment: GrafanaEnvironment,
  window: RoundWindow,
  panelIds: number[] | null,
): Promise<Round> {
  const unavailable: string[] = [];
  const rules = rulesOf(await client.get(rulesPath));

  let changes: StateChange[] = [];
  const range = `from=${window.from.getTime()}&to=${window.to.getTime()}`;
  try {
    changes = changesOf(await client.get(`/api/annotations?type=alert&${range}&limit=1000`), rules);
  } catch (error) {
    unavailable.push(`alert state changes: ${failureOf(error)}`);
  }

  const panels: PanelReading[] = [];
  const dashboardUid = `${environment}-heartbeat-daily`;
  try {
    const dashboard = await client.get(`/api/dashboards/uid/${dashboardUid}`);
    for (const panel of panelsToRead(dashboard, panelIds)) {
      try {
        panels.push(readingOf(panel, await client.query(panelQuery(panel, window))));
      } catch (error) {
        panels.push({ ...readingOf(panel, null), errors: [failureOf(error)] });
      }
    }
  } catch (error) {
    unavailable.push(`the ${dashboardUid} dashboard: ${failureOf(error)}`);
  }
  for (const panel of panels) {
    if (panel.errors.length > 0)
      unavailable.push(`panel ${panel.id} (${panel.title}): ${panel.errors.join("; ")}`);
  }

  return {
    environment,
    window: { from: isoOf(window.from.getTime()), to: isoOf(window.to.getTime()) },
    unavailable,
    rules,
    delta: deltaOf(rules, changes, window),
    changes,
    panels,
  };
}

export function summaryOf(round: Round, output: string): string {
  const firing = round.rules.filter((rule) => rule.state === "firing").length;
  const unhealthy = round.rules.filter((rule) => rule.health !== "ok").length;
  return [
    `wrote ${output}`,
    `${round.environment} ${round.window.from} to ${round.window.to}: ${round.rules.length} rules, ${firing} firing (${round.delta.new.length} new), ${unhealthy} not evaluating cleanly`,
    `${round.changes.length} state changes, ${round.delta.cleared.length} rules cleared, ${round.panels.length} panels read, ${round.unavailable.length} things unavailable`,
    "",
  ].join("\n");
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const root = repositoryRoot();
  const now = new Date();
  const window = parsed.since === null ? defaultWindow(now) : { from: parsed.since, to: now };
  const client = await requireGrafanaClient(root, process.env, parsed.environment);
  const round = await readRound(client, parsed.environment, window, parsed.panels);

  const output = pathFromRoot(parsed.output, root);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(round, null, 2)}\n`);
  process.stdout.write(summaryOf(round, output));
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
