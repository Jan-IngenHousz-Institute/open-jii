import { describe, expect, it, vi } from "vitest";

import type { GrafanaClient, GrafanaRule } from "../lib/grafana.js";
import {
  changesOf,
  defaultWindow,
  deltaOf,
  panelQuery,
  panelsToRead,
  parseArgs,
  readingOf,
  readRound,
} from "./round-read.js";

function rule(name: string, overrides: Partial<GrafanaRule> = {}): GrafanaRule {
  return {
    group: "g",
    name,
    metricId: null,
    severity: "warning",
    state: "inactive",
    health: "ok",
    activeSince: null,
    lastError: null,
    ...overrides,
  };
}

const window = { from: new Date("2026-09-28T09:00:00Z"), to: new Date("2026-09-29T09:00:00Z") };

describe("defaultWindow", () => {
  it("covers a day, or the weekend on a Monday", () => {
    const tuesday = new Date(2026, 8, 29, 9);
    const monday = new Date(2026, 8, 28, 9);

    expect(tuesday.getTime() - defaultWindow(tuesday).from.getTime()).toBe(24 * 3_600_000);
    expect(monday.getTime() - defaultWindow(monday).from.getTime()).toBe(72 * 3_600_000);
  });
});

describe("parseArgs", () => {
  it("defaults the output to the environment's file and parses the window and panels", () => {
    expect(parseArgs(["prod"])).toEqual({
      environment: "prod",
      since: null,
      panels: null,
      output: ".claude/round/prod.json",
    });
    expect(parseArgs(["--", "dev", "--since", "2026-09-25", "--panels", "89,91"])).toMatchObject({
      since: new Date("2026-09-25"),
      panels: [89, 91],
    });
    expect(() => parseArgs(["dev", "--since", "last week"])).toThrow("--since");
    expect(() => parseArgs(["dev", "--panels", "89,x"])).toThrow("--panels");
  });
});

describe("changesOf", () => {
  it("names each change's rule, preferring the longest matching name, and skips one without a time", () => {
    const rules = [rule("Ingest Lag"), rule("Ingest Lag Critical")];

    const changes = changesOf(
      [
        {
          time: Date.parse("2026-09-29T02:00:00Z"),
          text: "Ingest Lag Critical {…} - B=9",
          prevState: "Alerting",
          newState: "Normal",
        },
        {
          time: Date.parse("2026-09-29T01:00:00Z"),
          alertName: "Ingest Lag",
          text: "",
          prevState: "Normal",
          newState: "Alerting",
        },
        {
          time: Date.parse("2026-09-29T03:00:00Z"),
          text: "Removed rule",
          prevState: "Normal",
          newState: "Alerting",
        },
        { text: "Ingest Lag without a time", prevState: "Normal", newState: "Alerting" },
      ],
      rules,
    );

    expect(changes).toEqual([
      { time: "2026-09-29T01:00:00Z", rule: "Ingest Lag", from: "Normal", to: "Alerting" },
      { time: "2026-09-29T02:00:00Z", rule: "Ingest Lag Critical", from: "Alerting", to: "Normal" },
      { time: "2026-09-29T03:00:00Z", rule: null, from: "Normal", to: "Alerting" },
    ]);
  });
});

describe("deltaOf", () => {
  it("sorts firing rules into new and continuing, and names what cleared inside the window", () => {
    const rules = [
      rule("Fresh", { state: "firing", activeSince: "2026-09-29T06:00:00Z" }),
      rule("Old", { state: "firing", activeSince: "2026-09-25T08:00:00Z" }),
      rule("Flapped"),
      rule("Quiet"),
    ];
    const changes = [
      { time: "2026-09-28T12:00:00Z", rule: "Flapped", from: "Normal", to: "Alerting" },
      { time: "2026-09-28T12:30:00Z", rule: "Flapped", from: "Alerting", to: "Normal" },
      { time: "2026-09-29T06:00:00Z", rule: "Fresh", from: "Pending", to: "Alerting" },
      { time: "2026-09-28T13:00:00Z", rule: "Quiet", from: "Normal", to: "Pending" },
    ];

    expect(deltaOf(rules, changes, window)).toEqual({
      new: ["Fresh"],
      continuing: [{ rule: "Old", days: 4 }],
      cleared: ["Flapped"],
    });
  });
});

const dashboard = {
  dashboard: {
    panels: [
      { id: 900, type: "alertlist" },
      { id: 901, type: "state-timeline", datasource: { uid: "cw" }, targets: [{ refId: "E89" }] },
      {
        id: 299,
        type: "row",
        collapsed: true,
        panels: [{ id: 89, type: "timeseries", targets: [{ refId: "A" }] }],
      },
    ],
  },
};

describe("panelsToRead", () => {
  it("reads what the report shows open, or the panels asked for, collapsed or not", () => {
    expect(panelsToRead(dashboard, null).map((panel) => panel.id)).toEqual([901]);
    expect(panelsToRead(dashboard, [89]).map((panel) => panel.id)).toEqual([89]);
  });
});

describe("panelQuery", () => {
  it("fills the time macros, honours a pinned range, and falls back to the panel's data source", () => {
    const query = panelQuery(
      {
        datasource: { uid: "posthog" },
        timeFrom: "3d",
        targets: [
          {
            refId: "A",
            url_options: { data: "timestamp >= toDateTime('${__from:date:iso}') AND ${__to}" },
          },
          { refId: "B", hide: true },
        ],
      },
      window,
    );

    expect(query.from).toBe(String(Date.parse("2026-09-26T09:00:00Z")));
    expect(query.to).toBe(String(window.to.getTime()));
    expect(query.queries).toEqual([
      {
        refId: "A",
        url_options: {
          data: `timestamp >= toDateTime('2026-09-26T09:00:00.000Z') AND ${window.to.getTime()}`,
        },
        datasource: { uid: "posthog" },
        intervalMs: 300_000,
        maxDataPoints: 1000,
      },
    ]);
  });
});

function frame(refId: string, times: number[], readings: (number | null)[]) {
  return {
    [refId]: {
      frames: [
        {
          schema: {
            name: "raw",
            fields: [
              { name: "Time", type: "time" },
              { name: "Value", type: "number" },
            ],
          },
          data: { values: [times, readings] },
        },
      ],
    },
  };
}

describe("readingOf", () => {
  const t = (minute: number) => Date.parse("2026-09-29T08:00:00Z") + minute * 60_000;

  it("names a board row by its override and marks the stretches its limit colours red", () => {
    const board = {
      id: 901,
      title: "Signals with an alert rule",
      type: "state-timeline",
      fieldConfig: {
        overrides: [
          {
            matcher: { id: "byFrameRefID", options: "E89" },
            properties: [
              { id: "displayName", value: "Since last ingest" },
              {
                id: "thresholds",
                value: {
                  steps: [
                    { color: "#5c7", value: null },
                    { color: "red", value: 60 },
                  ],
                },
              },
            ],
          },
          {
            matcher: { id: "byFrameRefID", options: "E7" },
            properties: [
              {
                id: "thresholds",
                value: {
                  steps: [
                    { color: "red", value: null },
                    { color: "#5c7", value: 1 },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const reading = readingOf(board, {
      results: {
        ...frame("E89", [t(0), t(5), t(10), t(15), t(20)], [10, 70, 90, null, 65]),
        ...frame("E7", [t(0), t(5)], [0, 3]),
      },
    });

    expect(reading.series[0]).toMatchObject({
      name: "Since last ingest",
      readings: 4,
      max: 90,
      last: 65,
      red: [
        { from: "2026-09-29T08:05:00Z", to: "2026-09-29T08:10:00Z", worst: 90 },
        { from: "2026-09-29T08:20:00Z", to: "2026-09-29T08:20:00Z", worst: 65 },
      ],
    });
    expect(reading.series[0]?.points).toBeUndefined();
    expect(reading.series[1]).toMatchObject({ name: "raw", red: [{ worst: 0 }] });
  });

  it("keeps a chart's points and reads a frame without time as a table", () => {
    const reading = readingOf(
      { id: 902, title: "How much flows", type: "timeseries" },
      {
        results: {
          ...frame("P1", [t(0), t(30)], [4, 5]),
          T: {
            error: "PostHog timed out",
            frames: [
              {
                schema: {
                  fields: [
                    { name: "id", type: "string" },
                    { name: "events", type: "number" },
                  ],
                },
                data: {
                  values: [
                    ["a", "b"],
                    [3, 1],
                  ],
                },
              },
            ],
          },
        },
      },
    );

    expect(reading.series[0]?.points).toEqual([
      ["2026-09-29T08:00:00Z", 4],
      ["2026-09-29T08:30:00Z", 5],
    ]);
    expect(reading.tables).toEqual([
      {
        refId: "T",
        columns: ["id", "events"],
        rows: [
          ["a", 3],
          ["b", 1],
        ],
      },
    ]);
    expect(reading.errors).toEqual(["T: PostHog timed out"]);
  });
});

describe("readRound", () => {
  it("says what it could not read rather than leaving it out", async () => {
    const get = vi.fn<GrafanaClient["get"]>((path) => {
      if (path.startsWith("/api/prometheus")) {
        return Promise.resolve({
          data: {
            groups: [
              { name: "g", rules: [{ name: "Stall", state: "firing", health: "ok", alerts: [] }] },
            ],
          },
        });
      }
      if (path.startsWith("/api/annotations")) return Promise.reject(new Error("403"));
      return Promise.resolve(dashboard);
    });
    const query = vi
      .fn<GrafanaClient["query"]>()
      .mockRejectedValue(new Error("CloudWatch throttled"));

    const round = await readRound({ get, query }, "prod", window, null);

    expect(round.delta.continuing).toEqual([{ rule: "Stall", days: null }]);
    expect(round.unavailable).toEqual([
      "alert state changes: 403",
      "panel 901 (): CloudWatch throttled",
    ]);
    expect(get).toHaveBeenCalledWith(
      `/api/annotations?type=alert&from=${window.from.getTime()}&to=${window.to.getTime()}&limit=1000`,
    );
  });
});
