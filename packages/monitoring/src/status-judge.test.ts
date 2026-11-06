import { describe, expect, it } from "vitest";

import {
  DEPENDENCY_WINDOW_MINUTES,
  LAG_WINDOW_MINUTES,
  MACRO_FAILURE_WINDOW_MINUTES,
  PIPELINE_WINDOW_MINUTES,
  RULE_WINDOW_MINUTES,
  STATUS_SIGNAL_IDS,
  statusSignals,
} from "./status-components.js";
import type { StatusConfig, StatusReadings } from "./status-components.js";
import { STATUS_COMPONENT_IDS, statusDocumentSchema } from "./status-document.js";
import type {
  ComponentState,
  DayRecord,
  Incident,
  Notice,
  StatusComponent,
  StatusComponentId,
} from "./status-document.js";
import { DAY_DEGRADED_MINUTES, dayState } from "./status-history.js";
import {
  BAD_PROBES_FOR_DEGRADED,
  DELIVERY_DEGRADED_LATENCY_MINUTES,
  DELIVERY_OUTAGE_LATENCY_MINUTES,
  DELIVERY_STALL_IDLE_MINUTES,
  INGEST_OUTAGE_FAILURES,
  ITERATOR_AGE_DEGRADED_MINUTES,
  MACRO_DEGRADED_LATENCY_MINUTES,
  MACRO_OUTAGE_LATENCY_MINUTES,
  PLATFORM_MIN_ERRORS,
  PLATFORM_OUTAGE_ERROR_SHARE,
  PLATFORM_SLOW_PROBE_MS,
  PROBE_FAILURES_FOR_OUTAGE,
  PUBLISHER_STATE_VERSION,
  WEBSITE_MIN_REQUESTS,
  WEBSITE_OUTAGE_ERROR_PERCENT,
  WEBSITE_SLOW_PROBE_MS,
  endedAt,
  judgeComponent,
  judgeStatus,
  publisherStateSchema,
  worstState,
} from "./status-judge.js";
import type {
  ComponentEvidence,
  JudgeResult,
  PublisherState,
  StatusProbeResult,
  StatusProbes,
} from "./status-judge.js";
import { collapseReadings } from "./status-readings.js";

const LIVE_IDS: StatusComponentId[] = [
  "website",
  "platform",
  "data-intake",
  "data-delivery",
  "macro-processing",
];

const HEALTHY_PROBES: StatusProbes = {
  website: { ok: true, durationMs: 200 },
  platform: { ok: true, durationMs: 150 },
};

const HEALTHY_READINGS: StatusReadings = {
  websiteRequests: 100,
  websiteFailedRequests: 0,
  databaseUp: 1,
  databricksUp: 1,
  albElb5xx: 0,
  albTarget5xx: 0,
  albRequests: 500,
  emailUp: 1,
  ingestForwardingFailures: 0,
  ingestRefusedPublishes: 0,
  ingestThrottled: 0,
  iotUp: 1,
  deliveryLatencyP95: 20,
  ingestIdle: 2,
  devicePublishesBeforeIdle: 4500,
  collectorHeartbeat: 1,
  ingestIteratorAge: 1000,
  macroPlatformFailures: 0,
  macroLatencyP95: 10,
  macroBacklog: 0,
  exportsFailed: 0,
};

interface Change {
  readings?: StatusReadings;
  probeFailures?: number;
  badProbes?: number;
}

function evidence(change: Change = {}): ComponentEvidence {
  return {
    probeFailures: change.probeFailures ?? 0,
    badProbes: change.badProbes ?? 0,
    readings: { ...HEALTHY_READINGS, ...change.readings },
  };
}

interface Case {
  id: StatusComponentId;
  name: string;
  change: Change;
  state: ComponentState;
  delayMinutes?: number;
}

const FAILED_PROBE = { ok: false, durationMs: 10_000 };

const thresholdCases: Case[] = [
  { id: "website", name: "everything healthy", change: {}, state: "operational" },
  {
    id: "website",
    name: "one bad probe",
    change: { badProbes: BAD_PROBES_FOR_DEGRADED - 1 },
    state: "operational",
  },
  {
    id: "website",
    name: "bad probes in a row at the degraded count",
    change: { badProbes: BAD_PROBES_FOR_DEGRADED },
    state: "degraded",
  },
  {
    id: "website",
    name: "one failed probe",
    change: { probeFailures: 1, badProbes: 1 },
    state: "operational",
  },
  {
    id: "website",
    name: "failed probes one short of an outage",
    change: {
      probeFailures: PROBE_FAILURES_FOR_OUTAGE - 1,
      badProbes: PROBE_FAILURES_FOR_OUTAGE - 1,
    },
    state: "degraded",
  },
  {
    id: "website",
    name: "failed probes in a row at the outage count",
    change: { probeFailures: PROBE_FAILURES_FOR_OUTAGE, badProbes: PROBE_FAILURES_FOR_OUTAGE },
    state: "outage",
  },
  {
    id: "website",
    name: "bad probes past the outage count that did not all fail",
    change: {
      probeFailures: PROBE_FAILURES_FOR_OUTAGE - 1,
      badProbes: PROBE_FAILURES_FOR_OUTAGE + 2,
    },
    state: "degraded",
  },
  {
    id: "website",
    name: "half the requests failing",
    change: { readings: { websiteRequests: 40, websiteFailedRequests: 20 } },
    state: "operational",
  },
  {
    id: "website",
    name: "just over half the requests failing",
    change: { readings: { websiteRequests: 40, websiteFailedRequests: 21 } },
    state: "outage",
  },
  {
    id: "website",
    name: "every request failing below the request minimum",
    change: {
      readings: {
        websiteRequests: WEBSITE_MIN_REQUESTS - 1,
        websiteFailedRequests: WEBSITE_MIN_REQUESTS - 1,
      },
    },
    state: "operational",
  },
  {
    id: "website",
    name: "every request failing at the request minimum",
    change: {
      readings: {
        websiteRequests: WEBSITE_MIN_REQUESTS,
        websiteFailedRequests: WEBSITE_MIN_REQUESTS,
      },
    },
    state: "outage",
  },
  {
    id: "website",
    name: "no CloudFront datapoints",
    change: { readings: { websiteRequests: undefined, websiteFailedRequests: undefined } },
    state: "operational",
  },

  {
    id: "platform",
    name: "one bad probe",
    change: { badProbes: BAD_PROBES_FOR_DEGRADED - 1 },
    state: "operational",
  },
  {
    id: "platform",
    name: "bad probes in a row at the degraded count",
    change: { badProbes: BAD_PROBES_FOR_DEGRADED },
    state: "degraded",
  },
  {
    id: "platform",
    name: "one failed probe",
    change: { probeFailures: 1, badProbes: 1 },
    state: "operational",
  },
  {
    id: "platform",
    name: "failed probes in a row at the outage count",
    change: { probeFailures: PROBE_FAILURES_FOR_OUTAGE, badProbes: PROBE_FAILURES_FOR_OUTAGE },
    state: "outage",
  },
  {
    id: "platform",
    name: "the database check reading 1",
    change: { readings: { databaseUp: 1 } },
    state: "operational",
  },
  {
    id: "platform",
    name: "the database check reading below 1",
    change: { readings: { databaseUp: 0.99 } },
    state: "outage",
  },
  {
    id: "platform",
    name: "the database check reading 0",
    change: { readings: { databaseUp: 0 } },
    state: "outage",
  },
  {
    id: "platform",
    name: "no database check",
    change: { readings: { databaseUp: undefined } },
    state: "operational",
  },
  {
    id: "platform",
    name: "the Databricks check reading 0",
    change: { readings: { databricksUp: 0 } },
    state: "degraded",
  },
  {
    id: "platform",
    name: "no Databricks check",
    change: { readings: { databricksUp: undefined } },
    state: "operational",
  },
  {
    id: "platform",
    name: "half the requests answered with errors",
    change: { readings: { albElb5xx: 25, albTarget5xx: 25, albRequests: 100 } },
    state: "operational",
  },
  {
    id: "platform",
    name: "just over half the requests answered with errors",
    change: { readings: { albElb5xx: 26, albTarget5xx: 25, albRequests: 100 } },
    state: "outage",
  },
  {
    id: "platform",
    name: "errors at the error minimum and over half",
    change: {
      readings: { albElb5xx: 5, albTarget5xx: PLATFORM_MIN_ERRORS - 5, albRequests: 19 },
    },
    state: "outage",
  },
  {
    id: "platform",
    name: "errors at the error minimum and exactly half",
    change: {
      readings: { albElb5xx: 5, albTarget5xx: PLATFORM_MIN_ERRORS - 5, albRequests: 20 },
    },
    state: "operational",
  },
  {
    id: "platform",
    name: "every request an error below the error minimum",
    change: {
      readings: { albElb5xx: 0, albTarget5xx: PLATFORM_MIN_ERRORS - 1, albRequests: 9 },
    },
    state: "operational",
  },
  {
    id: "platform",
    name: "errors with no request count at all",
    change: { readings: { albElb5xx: PLATFORM_MIN_ERRORS, albRequests: undefined } },
    state: "outage",
  },

  {
    id: "data-intake",
    name: "no forwarding failures",
    change: { readings: { ingestForwardingFailures: 0 } },
    state: "operational",
  },
  {
    id: "data-intake",
    name: "one forwarding failure",
    change: { readings: { ingestForwardingFailures: 1 } },
    state: "degraded",
  },
  {
    id: "data-intake",
    name: "forwarding failures at the outage limit",
    change: { readings: { ingestForwardingFailures: INGEST_OUTAGE_FAILURES } },
    state: "degraded",
  },
  {
    id: "data-intake",
    name: "forwarding failures just over the outage limit",
    change: { readings: { ingestForwardingFailures: INGEST_OUTAGE_FAILURES + 1 } },
    state: "outage",
  },
  {
    id: "data-intake",
    name: "one refused publish",
    change: { readings: { ingestRefusedPublishes: 1 } },
    state: "degraded",
  },
  {
    id: "data-intake",
    name: "one throttled write",
    change: { readings: { ingestThrottled: 1 } },
    state: "degraded",
  },
  {
    id: "data-intake",
    name: "the IoT check reading 0",
    change: { readings: { iotUp: 0 } },
    state: "degraded",
  },
  {
    id: "data-intake",
    name: "no IoT check",
    change: { readings: { iotUp: undefined } },
    state: "operational",
  },
  {
    id: "data-intake",
    name: "no datapoints at all",
    change: {
      readings: {
        ingestForwardingFailures: undefined,
        ingestRefusedPublishes: undefined,
        ingestThrottled: undefined,
      },
    },
    state: "operational",
  },

  {
    id: "data-delivery",
    name: "latency at the degraded limit",
    change: { readings: { deliveryLatencyP95: DELIVERY_DEGRADED_LATENCY_MINUTES * 60 } },
    state: "operational",
  },
  {
    id: "data-delivery",
    name: "latency just over the degraded limit",
    change: { readings: { deliveryLatencyP95: DELIVERY_DEGRADED_LATENCY_MINUTES * 60 + 1 } },
    state: "degraded",
    delayMinutes: 15,
  },
  {
    id: "data-delivery",
    name: "latency that rounds up to the next minute",
    change: { readings: { deliveryLatencyP95: 930 } },
    state: "degraded",
    delayMinutes: 16,
  },
  {
    id: "data-delivery",
    name: "latency well inside degraded",
    change: { readings: { deliveryLatencyP95: 1500 } },
    state: "degraded",
    delayMinutes: 25,
  },
  {
    id: "data-delivery",
    name: "latency at the outage limit",
    change: { readings: { deliveryLatencyP95: DELIVERY_OUTAGE_LATENCY_MINUTES * 60 } },
    state: "degraded",
    delayMinutes: 60,
  },
  {
    id: "data-delivery",
    name: "latency just over the outage limit",
    change: { readings: { deliveryLatencyP95: DELIVERY_OUTAGE_LATENCY_MINUTES * 60 + 1 } },
    state: "outage",
    delayMinutes: 60,
  },
  {
    id: "data-delivery",
    name: "latency far over the outage limit",
    change: { readings: { deliveryLatencyP95: 5400 } },
    state: "outage",
    delayMinutes: 90,
  },
  {
    id: "data-delivery",
    name: "no latency datapoint",
    change: { readings: { deliveryLatencyP95: undefined } },
    state: "operational",
  },
  {
    id: "data-delivery",
    name: "iterator age at the limit",
    change: { readings: { ingestIteratorAge: ITERATOR_AGE_DEGRADED_MINUTES * 60_000 } },
    state: "operational",
  },
  {
    id: "data-delivery",
    name: "iterator age just over the limit",
    change: { readings: { ingestIteratorAge: ITERATOR_AGE_DEGRADED_MINUTES * 60_000 + 1 } },
    state: "degraded",
  },
  {
    id: "data-delivery",
    name: "no iterator age datapoint",
    change: { readings: { ingestIteratorAge: undefined } },
    state: "operational",
  },
  {
    id: "data-delivery",
    name: "bronze idle at the stall limit while devices publish",
    change: { readings: { ingestIdle: DELIVERY_STALL_IDLE_MINUTES } },
    state: "operational",
  },
  {
    id: "data-delivery",
    name: "bronze idle past the stall limit while devices publish",
    change: { readings: { ingestIdle: DELIVERY_STALL_IDLE_MINUTES + 0.1 } },
    state: "outage",
  },
  {
    id: "data-delivery",
    name: "bronze idle for hours on a quiet night with no device publishing",
    change: { readings: { ingestIdle: 600, devicePublishesBeforeIdle: undefined } },
    state: "operational",
  },
  {
    id: "data-delivery",
    name: "a stopped pipeline, which reports no latency and no iterator age",
    change: {
      readings: {
        deliveryLatencyP95: undefined,
        ingestIteratorAge: undefined,
        ingestIdle: 180,
      },
    },
    state: "outage",
  },
  {
    id: "data-delivery",
    name: "the Databricks check reading 0",
    change: { readings: { databricksUp: 0 } },
    state: "degraded",
  },
  {
    id: "data-delivery",
    name: "a silent collector",
    change: { readings: { collectorHeartbeat: undefined } },
    state: "outage",
  },

  {
    id: "macro-processing",
    name: "no platform failures",
    change: { readings: { macroPlatformFailures: 0 } },
    state: "operational",
  },
  {
    id: "macro-processing",
    name: "one platform failure",
    change: { readings: { macroPlatformFailures: 1 } },
    state: "degraded",
  },
  {
    id: "macro-processing",
    name: "no failure datapoints",
    change: { readings: { macroPlatformFailures: undefined } },
    state: "operational",
  },
  {
    id: "macro-processing",
    name: "latency at the degraded limit",
    change: { readings: { macroLatencyP95: MACRO_DEGRADED_LATENCY_MINUTES * 60 } },
    state: "operational",
  },
  {
    id: "macro-processing",
    name: "latency just over the degraded limit",
    change: { readings: { macroLatencyP95: MACRO_DEGRADED_LATENCY_MINUTES * 60 + 1 } },
    state: "degraded",
  },
  {
    id: "macro-processing",
    name: "latency at the outage limit",
    change: { readings: { macroLatencyP95: MACRO_OUTAGE_LATENCY_MINUTES * 60 } },
    state: "degraded",
  },
  {
    id: "macro-processing",
    name: "latency just over the outage limit",
    change: { readings: { macroLatencyP95: MACRO_OUTAGE_LATENCY_MINUTES * 60 + 1 } },
    state: "outage",
  },
  {
    id: "macro-processing",
    name: "a backlog of one row",
    change: { readings: { macroBacklog: 1 } },
    state: "degraded",
  },
  {
    id: "macro-processing",
    name: "no backlog datapoint",
    change: { readings: { macroBacklog: undefined } },
    state: "operational",
  },

  {
    id: "sign-in",
    name: "the email check reading 1",
    change: { readings: { emailUp: 1 } },
    state: "operational",
  },
  {
    id: "sign-in",
    name: "the email check reading 0",
    change: { readings: { emailUp: 0 } },
    state: "degraded",
  },
  {
    id: "sign-in",
    name: "no email check",
    change: { readings: { emailUp: undefined } },
    state: "operational",
  },
  {
    id: "exports",
    name: "no failed exports",
    change: { readings: { exportsFailed: 0 } },
    state: "operational",
  },
  {
    id: "exports",
    name: "one failed export",
    change: { readings: { exportsFailed: 1 } },
    state: "degraded",
  },
];

describe("the thresholds and windows", () => {
  it("keep the values the status page's rules were designed around", () => {
    expect({
      WEBSITE_SLOW_PROBE_MS,
      PLATFORM_SLOW_PROBE_MS,
      BAD_PROBES_FOR_DEGRADED,
      PROBE_FAILURES_FOR_OUTAGE,
      WEBSITE_OUTAGE_ERROR_PERCENT,
      WEBSITE_MIN_REQUESTS,
      PLATFORM_OUTAGE_ERROR_SHARE,
      PLATFORM_MIN_ERRORS,
      INGEST_OUTAGE_FAILURES,
      DELIVERY_DEGRADED_LATENCY_MINUTES,
      DELIVERY_OUTAGE_LATENCY_MINUTES,
      ITERATOR_AGE_DEGRADED_MINUTES,
      MACRO_DEGRADED_LATENCY_MINUTES,
      MACRO_OUTAGE_LATENCY_MINUTES,
      DAY_DEGRADED_MINUTES,
      RULE_WINDOW_MINUTES,
      MACRO_FAILURE_WINDOW_MINUTES,
      DEPENDENCY_WINDOW_MINUTES,
      LAG_WINDOW_MINUTES,
      PIPELINE_WINDOW_MINUTES,
    }).toEqual({
      WEBSITE_SLOW_PROBE_MS: 3000,
      PLATFORM_SLOW_PROBE_MS: 2000,
      BAD_PROBES_FOR_DEGRADED: 2,
      PROBE_FAILURES_FOR_OUTAGE: 3,
      WEBSITE_OUTAGE_ERROR_PERCENT: 50,
      WEBSITE_MIN_REQUESTS: 20,
      PLATFORM_OUTAGE_ERROR_SHARE: 0.5,
      PLATFORM_MIN_ERRORS: 10,
      INGEST_OUTAGE_FAILURES: 5,
      DELIVERY_DEGRADED_LATENCY_MINUTES: 15,
      DELIVERY_OUTAGE_LATENCY_MINUTES: 60,
      ITERATOR_AGE_DEGRADED_MINUTES: 10,
      MACRO_DEGRADED_LATENCY_MINUTES: 5,
      MACRO_OUTAGE_LATENCY_MINUTES: 30,
      DAY_DEGRADED_MINUTES: 5,
      RULE_WINDOW_MINUTES: 15,
      MACRO_FAILURE_WINDOW_MINUTES: 60,
      DEPENDENCY_WINDOW_MINUTES: 10,
      LAG_WINDOW_MINUTES: 5,
      PIPELINE_WINDOW_MINUTES: 75,
    });
  });
});

describe("judgeComponent thresholds", () => {
  it.each(thresholdCases)("$id with $name is $state", ({ id, change, state, delayMinutes }) => {
    const verdict = judgeComponent(id, evidence(change));

    expect(verdict.state).toBe(state);
    expect(verdict.delayMinutes).toBe(delayMinutes);
  });

  it("covers every component", () => {
    expect([...new Set(thresholdCases.map((entry) => entry.id))].sort()).toEqual(
      [...STATUS_COMPONENT_IDS].sort(),
    );
  });
});

describe("a dependency check whose newest answer failed after good ones", () => {
  const config: StatusConfig = {
    environment: "prod",
    albArnSuffix: "app/backend-alb/abc123",
    webDistributionId: "E2EXAMPLE",
    kinesisStreamName: "ingest-stream-prod",
  };
  const now = new Date("2026-11-03T12:00:00Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const checks = statusSignals(config).filter(
    ({ id }) => id === "databaseUp" || id === "databricksUp",
  );
  const readings = collapseReadings(
    checks,
    checks.map(({ id }) => ({
      Id: id,
      Timestamps: [minutesAgo(0), minutesAgo(5), minutesAgo(10)],
      Values: [0, 1, 1],
    })),
    now,
  );
  const affected: StatusComponentId[] = ["platform", "data-delivery"];

  it.each(affected)("leaves %s operational", (id) => {
    expect(judgeComponent(id, evidence({ readings })).state).toBe("operational");
  });
});

describe("the worst of several rules", () => {
  it.each([
    [
      "data-delivery",
      "a degraded rule beside an outage rule",
      { readings: { ingestIteratorAge: 700_000, collectorHeartbeat: undefined } },
      "outage",
    ],
    [
      "platform",
      "slow probes beside a database outage",
      { badProbes: BAD_PROBES_FOR_DEGRADED, readings: { databaseUp: 0 } },
      "outage",
    ],
    [
      "macro-processing",
      "two degraded rules",
      { readings: { macroBacklog: 4, macroPlatformFailures: 2 } },
      "degraded",
    ],
    [
      "data-intake",
      "an outage rule beside degraded ones",
      { readings: { ingestForwardingFailures: 9, ingestThrottled: 3, iotUp: 0 } },
      "outage",
    ],
  ] satisfies [StatusComponentId, string, Change, ComponentState][])(
    "%s with %s is %s",
    (id, _name, change, state) => {
      expect(judgeComponent(id, evidence(change)).state).toBe(state);
    },
  );

  it.each([
    [[], "operational"],
    [["operational", "degraded"], "degraded"],
    [["outage", "degraded", "operational"], "outage"],
    [["degraded", "degraded"], "degraded"],
  ] satisfies [ComponentState[], ComponentState][])(
    "worstState of %j is %s",
    (states, expected) => {
      expect(worstState(states)).toBe(expected);
    },
  );
});

function at(iso: string): Date {
  return new Date(iso);
}

interface RunChange extends Change {
  probes?: Partial<StatusProbes>;
  incidents?: Incident[];
  notices?: Notice[];
}

function run(
  previous: PublisherState | undefined,
  now: string,
  change: RunChange = {},
): JudgeResult {
  return judgeStatus({
    now: at(now),
    probes: { ...HEALTHY_PROBES, ...change.probes },
    readings: { ...HEALTHY_READINGS, ...change.readings },
    previous,
    incidents: change.incidents ?? [],
    notices: change.notices ?? [],
  });
}

function componentOf(result: JudgeResult, id: StatusComponentId): StatusComponent {
  const found = result.document.components.find((component) => component.id === id);
  if (found === undefined) {
    throw new Error(`no ${id} component in the document`);
  }
  return found;
}

function expectValid(result: JudgeResult): void {
  expect(statusDocumentSchema.parse(result.document)).toEqual(result.document);
  expect(publisherStateSchema.parse(result.state)).toEqual(result.state);
}

function cleanDay(date: string): DayRecord {
  const counts = {
    recordedMinutes: 1440,
    downMinutes: 0,
    degradedMinutes: 0,
    maintenanceMinutes: 0,
    unknownMinutes: 0,
  };
  return { date, ...counts, state: dayState(counts) };
}

function cleanDays(lastDate: string, count: number): DayRecord[] {
  const last = Date.parse(`${lastDate}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    cleanDay(new Date(last - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10)),
  );
}

function stateWithDays(
  lastJudgedAt: string,
  days: DayRecord[],
  ids: StatusComponentId[] = LIVE_IDS,
): PublisherState {
  const components: PublisherState["components"] = {};
  for (const id of ids) {
    components[id] = { probeFailures: 0, badProbes: 0, days };
  }
  return { version: PUBLISHER_STATE_VERSION, lastJudgedAt, components };
}

function incident(change: Partial<Incident> = {}): Incident {
  return {
    id: "inc-1",
    kind: "incident",
    title: "Something is wrong",
    impact: "degraded",
    components: ["platform"],
    startsAt: "2026-11-03T11:00:00.000Z",
    updates: [],
    ...change,
  };
}

describe("judgeStatus first run", () => {
  const result = run(undefined, "2026-11-03T12:00:30.000Z");

  it("judges only the live components, in contract order", () => {
    expect(result.document.components.map((component) => component.id)).toEqual(LIVE_IDS);
    expect(Object.keys(result.state.components).sort()).toEqual([...LIVE_IDS].sort());
  });

  it("starts each record at now, with no history before it", () => {
    for (const component of result.document.components) {
      expect(component.days).toHaveLength(1);
      expect(component.days[0]).toMatchObject({
        date: "2026-11-03",
        state: "operational",
        recordedMinutes: 1,
        unknownMinutes: 0,
      });
      expect(component.uptimePercent).toBe(100);
      expect(component.degradedMinutes).toBe(0);
    }
  });

  it("stamps the document and the state with now", () => {
    expect(result.document.generatedAt).toBe("2026-11-03T12:00:30.000Z");
    expect(result.state.lastJudgedAt).toBe("2026-11-03T12:00:30.000Z");
    expect(result.state.version).toBe(PUBLISHER_STATE_VERSION);
  });

  it("produces a document and a state the schemas accept", () => {
    expectValid(result);
  });

  it("carries the incidents and notices it was given", () => {
    const open = incident();
    const notice: Notice = { id: "notice-1", title: "Heads up", body: "", severity: "info" };
    const withContent = run(undefined, "2026-11-03T12:00:00.000Z", {
      incidents: [open],
      notices: [notice],
    });

    expect(result.document.incidents).toEqual([]);
    expect(result.document.notices).toEqual([]);
    expect(withContent.document.incidents).toEqual([open]);
    expect(withContent.document.notices).toEqual([notice]);
    expectValid(withContent);
  });
});

describe("recording measured outcomes", () => {
  it("records each component's own minute as operational, degraded or down", () => {
    const change = {
      probes: { website: { ok: true, durationMs: WEBSITE_SLOW_PROBE_MS + 1 } },
      readings: { ingestForwardingFailures: INGEST_OUTAGE_FAILURES + 1 },
    };
    const first = run(undefined, "2026-11-03T12:00:00.000Z", change);
    const result = run(first.state, "2026-11-03T12:01:00.000Z", change);

    expect(componentOf(result, "website")).toMatchObject({ state: "degraded", degradedMinutes: 1 });
    expect(componentOf(result, "data-intake").days[0]).toMatchObject({
      state: "outage",
      downMinutes: 2,
    });
    expect(componentOf(result, "data-intake").uptimePercent).toBe(0);
    expect(componentOf(result, "platform").state).toBe("operational");
    expectValid(result);
  });

  it("reports how far behind delivery is while latency makes it degraded or down", () => {
    const late = run(undefined, "2026-11-03T12:00:00.000Z", {
      readings: { deliveryLatencyP95: 1500 },
    });
    const recovered = run(late.state, "2026-11-03T12:01:00.000Z");

    expect(componentOf(late, "data-delivery")).toMatchObject({
      state: "degraded",
      delayMinutes: 25,
    });
    expect(componentOf(late, "data-intake")).not.toHaveProperty("delayMinutes");
    expect(componentOf(recovered, "data-delivery")).not.toHaveProperty("delayMinutes");
  });
});

type ProbedId = "website" | "platform";

type Step = "good" | "limit" | "slow" | "failed";

const SLOW_LIMIT_MS: Record<ProbedId, number> = {
  website: WEBSITE_SLOW_PROBE_MS,
  platform: PLATFORM_SLOW_PROBE_MS,
};

function probeFor(id: ProbedId, step: Step): StatusProbeResult {
  switch (step) {
    case "good":
      return HEALTHY_PROBES[id];
    case "limit":
      return { ok: true, durationMs: SLOW_LIMIT_MS[id] };
    case "slow":
      return { ok: true, durationMs: SLOW_LIMIT_MS[id] + 1 };
    case "failed":
      return FAILED_PROBE;
  }
}

function probesFor(id: ProbedId, probe: StatusProbeResult): Partial<StatusProbes> {
  return id === "website" ? { website: probe } : { platform: probe };
}

function minuteStamp(index: number): string {
  return `2026-11-03T12:${String(index).padStart(2, "0")}:00.000Z`;
}

/** One run per minute from 12:00, each with the probe its step describes. */
function runSteps(id: ProbedId, steps: Step[]): JudgeResult[] {
  const results: JudgeResult[] = [];
  let previous: PublisherState | undefined;

  for (const [index, step] of steps.entries()) {
    const result = run(previous, minuteStamp(index), {
      probes: probesFor(id, probeFor(id, step)),
    });
    results.push(result);
    previous = result.state;
  }

  return results;
}

interface StepCase {
  name: string;
  steps: Step[];
  states: ComponentState[];
  badProbes: number[];
  probeFailures: number[];
}

const stepCases: StepCase[] = [
  {
    name: "one slow probe",
    steps: ["slow"],
    states: ["operational"],
    badProbes: [1],
    probeFailures: [0],
  },
  {
    name: "two slow probes in a row",
    steps: ["slow", "slow"],
    states: ["operational", "degraded"],
    badProbes: [1, 2],
    probeFailures: [0, 0],
  },
  {
    name: "slow probes that never count as failures",
    steps: ["slow", "slow", "slow", "slow"],
    states: ["operational", "degraded", "degraded", "degraded"],
    badProbes: [1, 2, 3, 4],
    probeFailures: [0, 0, 0, 0],
  },
  {
    name: "a good probe between slow ones",
    steps: ["slow", "good", "slow"],
    states: ["operational", "operational", "operational"],
    badProbes: [1, 0, 1],
    probeFailures: [0, 0, 0],
  },
  {
    name: "a good probe after a degraded run",
    steps: ["slow", "slow", "good"],
    states: ["operational", "degraded", "operational"],
    badProbes: [1, 2, 0],
    probeFailures: [0, 0, 0],
  },
  {
    name: "probes at the slow limit",
    steps: ["limit", "limit", "limit"],
    states: ["operational", "operational", "operational"],
    badProbes: [0, 0, 0],
    probeFailures: [0, 0, 0],
  },
  {
    name: "one failed probe",
    steps: ["failed"],
    states: ["operational"],
    badProbes: [1],
    probeFailures: [1],
  },
  {
    name: "a failed probe then a slow one",
    steps: ["failed", "slow"],
    states: ["operational", "degraded"],
    badProbes: [1, 2],
    probeFailures: [1, 0],
  },
  {
    name: "failed probes up to the outage count",
    steps: ["failed", "failed", "failed"],
    states: ["operational", "degraded", "outage"],
    badProbes: [1, 2, 3],
    probeFailures: [1, 2, 3],
  },
  {
    name: "failed probes broken by a slow one",
    steps: ["failed", "failed", "slow", "failed"],
    states: ["operational", "degraded", "degraded", "degraded"],
    badProbes: [1, 2, 3, 4],
    probeFailures: [1, 2, 0, 1],
  },
  {
    name: "failed probes broken by a good one",
    steps: ["failed", "failed", "good", "failed"],
    states: ["operational", "degraded", "operational", "operational"],
    badProbes: [1, 2, 0, 1],
    probeFailures: [1, 2, 0, 1],
  },
];

describe.each<ProbedId>(["website", "platform"])("consecutive bad probes of %s", (id) => {
  it.each(stepCases)("reads $name", ({ steps, states, badProbes, probeFailures }) => {
    const results = runSteps(id, steps);

    expect(results.map((result) => componentOf(result, id).state)).toEqual(states);
    expect(results.map((result) => result.state.components[id]?.badProbes)).toEqual(badProbes);
    expect(results.map((result) => result.state.components[id]?.probeFailures)).toEqual(
      probeFailures,
    );
  });

  it.each([
    ["one fewer than the day limit", DAY_DEGRADED_MINUTES - 1, "operational"],
    ["the day limit", DAY_DEGRADED_MINUTES, "degraded"],
  ] satisfies [string, number, ComponentState][])(
    "colours the day for %s of degraded minutes as %s",
    (_name, degradedMinutes, expected) => {
      const steps: Step[] = Array.from(
        { length: BAD_PROBES_FOR_DEGRADED - 1 + degradedMinutes },
        () => "slow",
      );
      const last = runSteps(id, steps).at(-1);
      const component = last === undefined ? undefined : componentOf(last, id);

      expect(component?.days[0]).toMatchObject({ degradedMinutes, state: expected });
      expect(component?.degradedMinutes).toBe(degradedMinutes);
    },
  );
});

describe("the two probes", () => {
  it("are counted apart", () => {
    const first = run(undefined, "2026-11-03T12:00:00.000Z", {
      probes: { platform: FAILED_PROBE },
    });

    expect(first.state.components.platform).toMatchObject({ probeFailures: 1, badProbes: 1 });
    expect(first.state.components.website).toMatchObject({ probeFailures: 0, badProbes: 0 });
    expect(first.state.components["data-intake"]).toMatchObject({ probeFailures: 0, badProbes: 0 });
  });
});

describe("recording a minute only once", () => {
  it("leaves the history alone when the same minute runs again", () => {
    const first = run(undefined, "2026-11-03T12:00:05.000Z", {
      readings: { ingestForwardingFailures: 9 },
    });
    const again = run(first.state, "2026-11-03T12:00:50.000Z", {
      readings: { ingestForwardingFailures: 9 },
    });

    for (const id of LIVE_IDS) {
      expect(componentOf(again, id).days).toEqual(componentOf(first, id).days);
    }
    expect(componentOf(again, "data-intake").days[0]).toMatchObject({
      recordedMinutes: 1,
      downMinutes: 1,
    });
    expect(again.state.lastJudgedAt).toBe(first.state.lastJudgedAt);
    expectValid(again);
  });

  it.each([
    ["a failed probe", FAILED_PROBE, 2, 2],
    ["a slow probe", { ok: true, durationMs: WEBSITE_SLOW_PROBE_MS + 1 }, 0, 2],
  ] satisfies [string, StatusProbeResult, number, number][])(
    "does not advance either count for %s twice in the same minute",
    (_name, probe, probeFailures, badProbes) => {
      const change = { probes: { website: probe } };
      const first = run(undefined, "2026-11-03T12:00:05.000Z", change);
      const second = run(first.state, "2026-11-03T12:01:05.000Z", change);
      const again = run(second.state, "2026-11-03T12:01:50.000Z", change);

      expect(again.state.components.website).toMatchObject({ probeFailures, badProbes });
      expect(componentOf(again, "website").state).toBe("degraded");
      expect(componentOf(again, "website").days[0]).toMatchObject({
        recordedMinutes: 2,
        degradedMinutes: 1,
      });
    },
  );

  it("still judges the current evidence on a repeat", () => {
    const first = run(undefined, "2026-11-03T12:00:05.000Z");
    const again = run(first.state, "2026-11-03T12:00:50.000Z", {
      readings: { ingestForwardingFailures: 9 },
    });

    expect(componentOf(again, "data-intake").state).toBe("outage");
    expect(componentOf(again, "data-intake").days[0]?.downMinutes).toBe(0);
  });

  it("ignores a run stamped before the last judged minute", () => {
    const first = run(undefined, "2026-11-03T12:05:00.000Z");
    const earlier = run(first.state, "2026-11-03T12:03:00.000Z");
    const next = run(earlier.state, "2026-11-03T12:06:00.000Z");

    expect(earlier.state.lastJudgedAt).toBe("2026-11-03T12:05:00.000Z");
    expect(componentOf(next, "website").days[0]).toMatchObject({
      recordedMinutes: 2,
      unknownMinutes: 0,
    });
  });
});

describe("minutes that were not judged", () => {
  it("counts the minutes between two runs as unknown and recorded", () => {
    const first = run(undefined, "2026-11-03T12:00:00.000Z");
    const later = run(first.state, "2026-11-03T12:05:00.000Z");
    const website = componentOf(later, "website");

    expect(website.days[0]).toMatchObject({
      recordedMinutes: 6,
      unknownMinutes: 4,
      state: "operational",
    });
    expect(website.uptimePercent).toBe(33.33);
    expectValid(later);
  });

  it("adds nothing for consecutive minutes", () => {
    const first = run(undefined, "2026-11-03T12:00:00.000Z");
    const next = run(first.state, "2026-11-03T12:01:00.000Z");

    expect(componentOf(next, "website").days[0]).toMatchObject({
      recordedMinutes: 2,
      unknownMinutes: 0,
    });
  });

  it("splits a gap across UTC midnight onto each day", () => {
    const first = run(undefined, "2026-11-02T23:58:30.000Z");
    const later = run(first.state, "2026-11-03T00:03:10.000Z");
    const days = componentOf(later, "platform").days;

    expect(days.map((day) => [day.date, day.recordedMinutes, day.unknownMinutes])).toEqual([
      ["2026-11-02", 2, 1],
      ["2026-11-03", 4, 3],
    ]);
    expectValid(later);
  });

  it("does not colour a day for minutes it could not check", () => {
    const first = run(undefined, "2026-11-03T12:00:00.000Z");
    const later = run(first.state, "2026-11-03T12:30:00.000Z");

    expect(componentOf(later, "website").days[0]?.state).toBe("operational");
  });

  it("starts a component that became live at now, without unknown history", () => {
    const startedToday = { ...cleanDay("2026-11-03"), recordedMinutes: 1 };
    const previous = stateWithDays("2026-11-03T11:55:00.000Z", [startedToday], ["website"]);
    const result = run(previous, "2026-11-03T12:00:00.000Z");

    expect(componentOf(result, "website").days[0]?.unknownMinutes).toBe(4);
    expect(componentOf(result, "platform").days).toHaveLength(1);
    expect(componentOf(result, "platform").days[0]).toMatchObject({
      recordedMinutes: 1,
      unknownMinutes: 0,
    });
    expectValid(result);
  });
});

describe.each<ProbedId>(["website", "platform"])("probe streaks of %s across a gap", (id) => {
  const failed = { probes: probesFor(id, FAILED_PROBE) };

  it("start again after minutes that were not judged", () => {
    const first = run(undefined, minuteStamp(0), failed);
    const second = run(first.state, minuteStamp(1), failed);
    const afterGap = run(second.state, minuteStamp(5), failed);

    expect(second.state.components[id]).toMatchObject({ probeFailures: 2, badProbes: 2 });
    expect(afterGap.state.components[id]).toMatchObject({ probeFailures: 1, badProbes: 1 });
    expect(componentOf(afterGap, id).state).toBe("operational");
  });

  it("keep counting when every minute was judged", () => {
    const first = run(undefined, minuteStamp(0), failed);
    const second = run(first.state, minuteStamp(1), failed);
    const third = run(second.state, minuteStamp(2), failed);

    expect(third.state.components[id]).toMatchObject({ probeFailures: 3, badProbes: 3 });
    expect(componentOf(third, id).state).toBe("outage");
  });
});

describe("keeping ninety days", () => {
  it("drops the oldest day when a new one begins", () => {
    const previous = stateWithDays("2026-11-02T23:59:00.000Z", cleanDays("2026-11-02", 90));
    const result = run(previous, "2026-11-03T00:00:00.000Z");
    const days = componentOf(result, "website").days;

    expect(days).toHaveLength(90);
    expect(days[0]?.date).toBe("2026-08-06");
    expect(days[89]).toMatchObject({ date: "2026-11-03", recordedMinutes: 1 });
    expectValid(result);
  });

  it("keeps ninety days when a gap longer than the history has passed", () => {
    const previous = stateWithDays("2026-05-01T00:00:00.000Z", cleanDays("2026-05-01", 90));
    const result = run(previous, "2026-11-03T12:00:00.000Z");
    const website = componentOf(result, "website");

    expect(website.days).toHaveLength(90);
    expect(website.days[0]).toMatchObject({
      date: "2026-08-06",
      recordedMinutes: 1440,
      unknownMinutes: 1440,
    });
    expect(website.days[89]).toMatchObject({
      date: "2026-11-03",
      recordedMinutes: 721,
      unknownMinutes: 720,
    });
    expect(website.uptimePercent).toBe(0);
    expectValid(result);
  });
});

describe("uptime and degraded minutes in the document", () => {
  it("excludes maintenance from uptime and sums degraded minutes over the kept days", () => {
    const days = [
      { ...cleanDay("2026-11-01"), degradedMinutes: 30, downMinutes: 72, maintenanceMinutes: 720 },
      { ...cleanDay("2026-11-02"), degradedMinutes: 12 },
    ];
    const previous = stateWithDays("2026-11-02T23:59:00.000Z", days);
    const result = run(previous, "2026-11-03T00:00:00.000Z");
    const website = componentOf(result, "website");

    expect(website.degradedMinutes).toBe(42);
    expect(website.uptimePercent).toBe(Math.round(10_000 * (1 - 72 / (2881 - 720))) / 100);
  });
});

describe("open incidents", () => {
  const now = "2026-11-03T12:00:00.000Z";

  it("raises the state to the incident's impact and records the minute that way", () => {
    const result = run(undefined, now, {
      incidents: [incident({ impact: "outage", components: ["platform", "exports"] })],
    });

    expect(componentOf(result, "platform")).toMatchObject({ state: "outage" });
    expect(componentOf(result, "platform").days[0]).toMatchObject({
      downMinutes: 1,
      state: "outage",
    });
    expect(componentOf(result, "website").state).toBe("operational");
    expectValid(result);
  });

  it("records a degraded incident as a degraded minute", () => {
    const result = run(undefined, now, { incidents: [incident({ impact: "degraded" })] });

    expect(componentOf(result, "platform")).toMatchObject({
      state: "degraded",
      degradedMinutes: 1,
    });
  });

  it("applies to every component it names", () => {
    const result = run(undefined, now, {
      incidents: [incident({ components: ["website", "data-delivery"] })],
    });

    expect(componentOf(result, "website").state).toBe("degraded");
    expect(componentOf(result, "data-delivery").state).toBe("degraded");
    expect(componentOf(result, "data-intake").state).toBe("operational");
  });

  it("does not lower a measured outage", () => {
    const result = run(undefined, now, {
      probes: { platform: FAILED_PROBE },
      readings: { databaseUp: 0 },
      incidents: [incident({ impact: "degraded" })],
    });

    expect(componentOf(result, "platform").state).toBe("outage");
  });

  it.each([
    ["resolved before now", { resolvedAt: "2026-11-03T11:30:00.000Z" }],
    ["not started yet", { startsAt: "2026-11-03T13:00:00.000Z" }],
  ] satisfies [string, Partial<Incident>][])("does not apply once it is %s", (_name, change) => {
    const result = run(undefined, now, { incidents: [incident({ impact: "outage", ...change })] });

    expect(componentOf(result, "platform").state).toBe("operational");
  });

  it("applies until the time it is resolved", () => {
    const result = run(undefined, now, {
      incidents: [incident({ impact: "outage", resolvedAt: "2026-11-03T12:30:00.000Z" })],
    });

    expect(componentOf(result, "platform").state).toBe("outage");
  });

  it("keeps applying past an incident's end time until someone resolves it", () => {
    const result = run(undefined, now, {
      incidents: [incident({ impact: "outage", endsAt: "2026-11-03T11:30:00.000Z" })],
    });

    expect(componentOf(result, "platform").state).toBe("outage");
  });
});

describe("endedAt", () => {
  it.each([
    ["an incident still open", incident(), undefined],
    [
      "an incident, by its resolution",
      incident({ resolvedAt: "2026-11-03T11:30:00.000Z" }),
      "2026-11-03T11:30:00.000Z",
    ],
    [
      "an incident, ignoring a planned end",
      incident({ endsAt: "2026-11-03T11:30:00.000Z" }),
      undefined,
    ],
    [
      "a window nobody closed, by its planned end",
      incident({ kind: "maintenance", endsAt: "2026-11-03T13:00:00.000Z" }),
      "2026-11-03T13:00:00.000Z",
    ],
    [
      "a window resolved before its planned end",
      incident({
        kind: "maintenance",
        endsAt: "2026-11-03T13:00:00.000Z",
        resolvedAt: "2026-11-03T12:10:00.000Z",
      }),
      "2026-11-03T12:10:00.000Z",
    ],
    [
      "a window resolved after its planned end",
      incident({
        kind: "maintenance",
        endsAt: "2026-11-03T12:10:00.000Z",
        resolvedAt: "2026-11-03T13:00:00.000Z",
      }),
      "2026-11-03T12:10:00.000Z",
    ],
  ])("gives the end of %s", (_name, entry, expected) => {
    expect(endedAt(entry)).toBe(expected);
  });
});

describe("maintenance", () => {
  const now = "2026-11-03T12:00:00.000Z";
  const maintenance = incident({ id: "maint-1", kind: "maintenance", components: ["platform"] });

  it("records the minute as maintenance even when something measured is down", () => {
    const result = run(undefined, now, {
      probes: { platform: FAILED_PROBE },
      readings: { databaseUp: 0 },
      incidents: [maintenance],
    });

    expect(componentOf(result, "platform").days[0]).toMatchObject({
      state: "maintenance",
      maintenanceMinutes: 1,
      downMinutes: 0,
      degradedMinutes: 0,
    });
    expect(componentOf(result, "platform").uptimePercent).toBe(100);
    expectValid(result);
  });

  it("shows the component as under maintenance, not as the outage the window causes", () => {
    const result = run(undefined, now, {
      probes: { platform: FAILED_PROBE },
      readings: { databaseUp: 0 },
      incidents: [{ ...maintenance, impact: "outage" }],
    });

    expect(componentOf(result, "platform").state).toBe("maintenance");
    expectValid(result);
  });

  it("goes back to the measured state once the window has ended", () => {
    const result = run(undefined, now, {
      readings: { databaseUp: 0 },
      incidents: [{ ...maintenance, endsAt: "2026-11-03T11:59:00.000Z" }],
    });

    expect(componentOf(result, "platform").state).toBe("outage");
  });

  it("leaves other components measured as usual", () => {
    const result = run(undefined, now, {
      readings: { ingestForwardingFailures: INGEST_OUTAGE_FAILURES + 1 },
      incidents: [maintenance],
    });

    expect(componentOf(result, "data-intake").days[0]).toMatchObject({
      state: "outage",
      downMinutes: 1,
    });
  });

  it("stops overriding once its window has ended", () => {
    const result = run(undefined, now, {
      probes: { platform: FAILED_PROBE },
      readings: { databaseUp: 0 },
      incidents: [{ ...maintenance, endsAt: "2026-11-03T11:59:00.000Z" }],
    });

    expect(componentOf(result, "platform").days[0]).toMatchObject({
      state: "outage",
      maintenanceMinutes: 0,
      downMinutes: 1,
    });
  });

  it("does not override before it starts or after it is resolved", () => {
    const before = run(undefined, now, {
      readings: { databaseUp: 0 },
      incidents: [{ ...maintenance, startsAt: "2026-11-03T12:30:00.000Z" }],
    });
    const after = run(undefined, now, {
      readings: { databaseUp: 0 },
      incidents: [{ ...maintenance, resolvedAt: "2026-11-03T11:45:00.000Z" }],
    });

    expect(componentOf(before, "platform").days[0]?.maintenanceMinutes).toBe(0);
    expect(componentOf(after, "platform").days[0]?.maintenanceMinutes).toBe(0);
  });

  it("applies while the window is open and nobody has resolved it", () => {
    const result = run(undefined, now, {
      incidents: [{ ...maintenance, endsAt: "2026-11-03T12:30:00.000Z" }],
    });

    expect(componentOf(result, "platform").days[0]?.maintenanceMinutes).toBe(1);
  });
});

describe("state round trip", () => {
  it("survives JSON and keeps recording on the same history", () => {
    let result = run(undefined, "2026-11-03T12:00:00.000Z");
    result = run(result.state, "2026-11-03T12:01:00.000Z", { probes: { website: FAILED_PROBE } });

    const stored = publisherStateSchema.parse(JSON.parse(JSON.stringify(result.state)));
    const next = run(stored, "2026-11-03T12:02:00.000Z", { probes: { website: FAILED_PROBE } });

    expect(stored).toEqual(result.state);
    expect(next.state.components.website).toMatchObject({ probeFailures: 2, badProbes: 2 });
    expect(componentOf(next, "website").days[0]).toMatchObject({ recordedMinutes: 3 });
    expectValid(next);
  });

  it("rejects a state with a bad version or a bad day", () => {
    const result = run(undefined, "2026-11-03T12:00:00.000Z");

    expect(publisherStateSchema.safeParse({ ...result.state, version: 2 }).success).toBe(false);
    expect(
      publisherStateSchema.safeParse({
        ...result.state,
        components: { website: { probeFailures: -1, badProbes: 0, days: [] } },
      }).success,
    ).toBe(false);
    expect(
      publisherStateSchema.safeParse({
        ...result.state,
        components: { website: { probeFailures: 0, badProbes: -1, days: [] } },
      }).success,
    ).toBe(false);
  });
});

describe("the healthy readings", () => {
  it("hold a value for every signal, so a test changes one thing at a time", () => {
    expect(Object.keys(HEALTHY_READINGS).sort()).toEqual([...STATUS_SIGNAL_IDS].sort());
  });
});
