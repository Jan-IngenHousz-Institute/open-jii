import { z } from "zod/mini";

import { INGEST_THROUGHPUT_WINDOW_MINUTES, STATUS_COMPONENTS } from "./status-components.js";
import type { StatusReadings } from "./status-components.js";
import {
  STATUS_DOCUMENT_VERSION,
  STATUS_HISTORY_DAYS,
  dayRecordSchema,
  endedAt,
  statusComponentIdSchema,
} from "./status-document.js";
import type {
  ComponentState,
  DayRecord,
  Incident,
  Notice,
  StatusComponent,
  StatusComponentId,
  StatusDocument,
} from "./status-document.js";
import {
  minuteOf,
  recordMinute,
  recordUnknown,
  totalDegradedMinutes,
  uptimePercent,
} from "./status-history.js";

/** A page that takes longer than this to answer feels broken to a visitor, even though it loads. */
export const WEBSITE_SLOW_PROBE_MS = 3000;

/** The API answers a cheap health request, so two seconds means it is struggling. */
export const PLATFORM_SLOW_PROBE_MS = 2000;

/** One slow or failed probe is often a cold start or a dropped request, so degraded needs two in a row. */
export const BAD_PROBES_FOR_DEGRADED = 2;

/** One failed probe is often the network between us and the service, three in a row is the service. */
export const PROBE_FAILURES_FOR_OUTAGE = 3;

/** Past half the requests failing, CloudFront is not serving the site. */
export const WEBSITE_OUTAGE_ERROR_PERCENT = 50;

/** Fewer requests than this in the window make an error rate noise, so it cannot declare an outage. */
export const WEBSITE_MIN_REQUESTS = 20;

/** Past half the requests answered with a 5xx, the API is failing more than it serves. */
export const PLATFORM_OUTAGE_ERROR_SHARE = 0.5;

/** A handful of errors in a quiet window is a blip, so an outage needs at least this many. */
export const PLATFORM_MIN_ERRORS = 10;

/** A few failed forwards can be a retry that lands, so only past this many is data being lost. */
export const INGEST_OUTAGE_FAILURES = 5;

/** Researchers notice data that arrives a quarter of an hour late, so that is degraded. */
export const DELIVERY_DEGRADED_LATENCY_MINUTES = 15;

/** An hour behind, new measurements are effectively not arriving. */
export const DELIVERY_OUTAGE_LATENCY_MINUTES = 60;

/** The consumer ten minutes behind the stream is falling behind rather than catching up. */
export const ITERATOR_AGE_DEGRADED_MINUTES = 10;

/** Bronze idle this long while devices publish is a stopped pipeline, as Ingest Stalled reads it. */
export const DELIVERY_STALL_IDLE_MINUTES = 60;

/** Macro results more than five minutes after their measurement are slower than a researcher expects. */
export const MACRO_DEGRADED_LATENCY_MINUTES = 5;

/** Half an hour late, macro results are not usable while the researcher is still at the device. */
export const MACRO_OUTAGE_LATENCY_MINUTES = 30;

export const PUBLISHER_STATE_VERSION = 1;

const componentHistorySchema = z.object({
  /** Probes failed in a row, up to and including the last judged minute; zero for a component without a probe. */
  probeFailures: z.int().check(z.nonnegative()),
  /** Probes failed or slower than their limit in a row, counted like `probeFailures`. */
  badProbes: z.int().check(z.nonnegative()),
  days: z.array(dayRecordSchema).check(z.maxLength(STATUS_HISTORY_DAYS)),
});
type ComponentHistory = z.infer<typeof componentHistorySchema>;

/** What the publisher carries between runs. It holds history the document shows and nothing more. */
export const publisherStateSchema = z.object({
  version: z.literal(PUBLISHER_STATE_VERSION),
  lastJudgedAt: z.iso.datetime(),
  /** Only live components; one that goes live later starts its history at its first run. */
  components: z.partialRecord(statusComponentIdSchema, componentHistorySchema),
});
export type PublisherState = z.infer<typeof publisherStateSchema>;

export interface StatusProbeResult {
  ok: boolean;
  durationMs: number;
}

export interface StatusProbes {
  website: StatusProbeResult;
  platform: StatusProbeResult;
}

export interface ComponentEvidence {
  /** Failed probes in a row for this component's own probe, this run included. */
  probeFailures: number;
  /** Failed or slow probes in a row for this component's own probe, this run included. */
  badProbes: number;
  readings: StatusReadings;
}

/** What the checks can say; maintenance comes only from a planned window. */
type MeasuredState = Exclude<ComponentState, "maintenance">;

interface ComponentVerdict {
  state: MeasuredState;
  /** How far behind new measurements are, when that is what the state says. */
  delayMinutes?: number;
}

const STATE_RANK: Record<MeasuredState, number> = { operational: 0, degraded: 1, outage: 2 };

export function worstState(states: MeasuredState[]): MeasuredState {
  return states.reduce<MeasuredState>(
    (worst, state) => (STATE_RANK[state] > STATE_RANK[worst] ? state : worst),
    "operational",
  );
}

function stateOf(isOutage: boolean, isDegraded: boolean): MeasuredState {
  if (isOutage) {
    return "outage";
  }
  return isDegraded ? "degraded" : "operational";
}

/** A check reading 0 says the dependency failed; no reading says nothing, since the probe covers a dead producer. */
function isDependencyDown(reading: number | undefined): boolean {
  return reading !== undefined && reading < 1;
}

function judgeWebsite({ probeFailures, badProbes, readings }: ComponentEvidence): ComponentVerdict {
  const requests = readings.websiteRequests ?? 0;
  const failedRequests = readings.websiteFailedRequests ?? 0;

  const isUnreachable = probeFailures >= PROBE_FAILURES_FOR_OUTAGE;
  const isServingErrors =
    requests >= WEBSITE_MIN_REQUESTS &&
    failedRequests * 100 > requests * WEBSITE_OUTAGE_ERROR_PERCENT;
  const isSlowOrFailing = badProbes >= BAD_PROBES_FOR_DEGRADED;

  return { state: stateOf(isUnreachable || isServingErrors, isSlowOrFailing) };
}

function judgePlatform({
  probeFailures,
  badProbes,
  readings,
}: ComponentEvidence): ComponentVerdict {
  const errors = (readings.albElb5xx ?? 0) + (readings.albTarget5xx ?? 0);
  const requests = readings.albRequests ?? 0;

  const isUnreachable = probeFailures >= PROBE_FAILURES_FOR_OUTAGE;
  const isErroring =
    errors >= PLATFORM_MIN_ERRORS && errors > requests * PLATFORM_OUTAGE_ERROR_SHARE;
  const isDatabaseDown = isDependencyDown(readings.databaseUp);
  const isSlowOrFailing = badProbes >= BAD_PROBES_FOR_DEGRADED;
  const isDatabricksDown = isDependencyDown(readings.databricksUp);

  return {
    state: stateOf(
      isUnreachable || isDatabaseDown || isErroring,
      isSlowOrFailing || isDatabricksDown,
    ),
  };
}

function judgeDataIntake({ readings }: ComponentEvidence): ComponentVerdict {
  const failures = readings.ingestForwardingFailures ?? 0;

  const isLosingData = failures > INGEST_OUTAGE_FAILURES;
  const isFailingSome = failures > 0;
  const isRefusing = (readings.ingestRefusedPublishes ?? 0) > 0;
  const isThrottled = (readings.ingestThrottled ?? 0) > 0;
  const isBrokerDown = isDependencyDown(readings.iotUp);

  return {
    state: stateOf(isLosingData, isFailingSome || isRefusing || isThrottled || isBrokerDown),
  };
}

function judgeDataDelivery({ readings }: ComponentEvidence): ComponentVerdict {
  const latencySeconds = readings.deliveryLatencyP95 ?? 0;
  const iteratorAgeMs = readings.ingestIteratorAge ?? 0;

  const isLate = latencySeconds > DELIVERY_DEGRADED_LATENCY_MINUTES * 60;
  const isVeryLate = latencySeconds > DELIVERY_OUTAGE_LATENCY_MINUTES * 60;
  const isSilent = readings.collectorHeartbeat === undefined;
  // A stopped pipeline reports no latency at all, so only bronze's idle time beside devices still
  // publishing shows it.
  const isStalled =
    (readings.ingestIdle ?? 0) > DELIVERY_STALL_IDLE_MINUTES &&
    (readings.devicePublishesBeforeIdle ?? 0) > 0;
  const isBehindStream = iteratorAgeMs > ITERATOR_AGE_DEGRADED_MINUTES * 60_000;
  const isDatabricksDown = isDependencyDown(readings.databricksUp);

  return {
    state: stateOf(
      isVeryLate || isSilent || isStalled,
      isLate || isBehindStream || isDatabricksDown,
    ),
    ...(isLate ? { delayMinutes: Math.round(latencySeconds / 60) } : {}),
  };
}

function judgeMacroProcessing({ readings }: ComponentEvidence): ComponentVerdict {
  const latencySeconds = readings.macroLatencyP95 ?? 0;

  const isVeryLate = latencySeconds > MACRO_OUTAGE_LATENCY_MINUTES * 60;
  const isLate = latencySeconds > MACRO_DEGRADED_LATENCY_MINUTES * 60;
  const isFailing = (readings.macroPlatformFailures ?? 0) > 0;
  const isBacklogged = (readings.macroBacklog ?? 0) > 0;

  return { state: stateOf(isVeryLate, isLate || isFailing || isBacklogged) };
}

/** The worst state any rule of the component reaches, from the evidence alone. */
export function judgeComponent(
  id: StatusComponentId,
  evidence: ComponentEvidence,
): ComponentVerdict {
  switch (id) {
    case "website":
      return judgeWebsite(evidence);
    case "sign-in":
      return { state: stateOf(false, isDependencyDown(evidence.readings.emailUp)) };
    case "platform":
      return judgePlatform(evidence);
    case "data-intake":
      return judgeDataIntake(evidence);
    case "data-delivery":
      return judgeDataDelivery(evidence);
    case "macro-processing":
      return judgeMacroProcessing(evidence);
    case "exports":
      return { state: stateOf(false, (evidence.readings.exportsFailed ?? 0) > 0) };
  }
}

/**
 * Open from its start until it is resolved. Planned work also ends at its scheduled end, so a
 * window nobody closed cannot hide a real outage behind it.
 */
export function isOpen(incident: Incident, atMs: number): boolean {
  const hasStarted = Date.parse(incident.startsAt) <= atMs;
  const end = endedAt(incident);
  const hasEnded = end !== undefined && Date.parse(end) <= atMs;

  return hasStarted && !hasEnded;
}

interface ComponentProbe {
  result: StatusProbeResult;
  slowMs: number;
}

function probeOf(id: StatusComponentId, probes: StatusProbes): ComponentProbe | undefined {
  switch (id) {
    case "website":
      return { result: probes.website, slowMs: WEBSITE_SLOW_PROBE_MS };
    case "platform":
      return { result: probes.platform, slowMs: PLATFORM_SLOW_PROBE_MS };
    default:
      return undefined;
  }
}

interface JudgeInput {
  now: Date;
  probes: StatusProbes;
  readings: StatusReadings;
  /** Undefined on the first run. */
  previous: PublisherState | undefined;
  incidents: Incident[];
  notices: Notice[];
}

export interface JudgeResult {
  document: StatusDocument;
  state: PublisherState;
}

interface Run extends JudgeInput {
  minute: number;
  previousMinute: number | undefined;
  /** The minute was already judged, so recording it again would count it twice. */
  isRepeat: boolean;
  /** Minutes were skipped since the last judged one, so no probe streak spans them. */
  isAfterGap: boolean;
}

type ProbeStreaks = Pick<ComponentEvidence, "probeFailures" | "badProbes">;

const NO_STREAKS: ProbeStreaks = { probeFailures: 0, badProbes: 0 };

function nextProbeStreaks(
  previous: ProbeStreaks,
  probe: ComponentProbe | undefined,
  isRepeat: boolean,
): ProbeStreaks {
  if (probe === undefined || isRepeat) {
    return previous;
  }

  const isFailed = !probe.result.ok;
  const isBad = isFailed || probe.result.durationMs > probe.slowMs;

  return {
    probeFailures: isFailed ? previous.probeFailures + 1 : 0,
    badProbes: isBad ? previous.badProbes + 1 : 0,
  };
}

function advanceDays(
  history: ComponentHistory | undefined,
  run: Run,
  outcome: ComponentState,
): DayRecord[] {
  if (history === undefined || run.previousMinute === undefined) {
    return recordMinute([], run.minute, outcome);
  }
  if (run.isRepeat) {
    return history.days;
  }

  const withGap = recordUnknown(history.days, run.previousMinute + 1, run.minute - 1);
  return recordMinute(withGap, run.minute, outcome);
}

function judgeLiveComponent(id: StatusComponentId, run: Run) {
  const history = run.previous?.components[id];
  const carried = run.isAfterGap
    ? NO_STREAKS
    : { probeFailures: history?.probeFailures ?? 0, badProbes: history?.badProbes ?? 0 };
  const { probeFailures, badProbes } = nextProbeStreaks(
    carried,
    probeOf(id, run.probes),
    run.isRepeat,
  );

  const verdict = judgeComponent(id, { probeFailures, badProbes, readings: run.readings });

  const open = run.incidents.filter(
    (incident) => incident.components.includes(id) && isOpen(incident, run.now.getTime()),
  );
  const incidentImpacts = open
    .filter((incident) => incident.kind === "incident")
    .map((incident) => incident.impact);
  const measured = worstState([verdict.state, ...incidentImpacts]);
  const isUnderMaintenance = open.some((incident) => incident.kind === "maintenance");
  const state = isUnderMaintenance ? "maintenance" : measured;
  const days = advanceDays(history, run, state);

  const component: StatusComponent = {
    id,
    state,
    ...(verdict.delayMinutes === undefined ? {} : { delayMinutes: verdict.delayMinutes }),
    uptimePercent: uptimePercent(days),
    degradedMinutes: totalDegradedMinutes(days),
    days,
  };

  return { component, history: { probeFailures, badProbes, days } };
}

/**
 * Judges one run: the live components' states, their history with this minute recorded, and the
 * document to publish. A run in a minute already judged changes no history, so a retried invocation
 * cannot count it twice.
 */
export function judgeStatus(input: JudgeInput): JudgeResult {
  const { now, previous } = input;
  const minute = minuteOf(now);
  const previousMinute =
    previous === undefined ? undefined : minuteOf(new Date(previous.lastJudgedAt));
  const isRepeat = previousMinute !== undefined && minute <= previousMinute;
  const isAfterGap = previousMinute !== undefined && minute > previousMinute + 1;
  const run: Run = { ...input, minute, previousMinute, isRepeat, isAfterGap };

  const components: StatusComponent[] = [];
  const histories: PublisherState["components"] = {};

  for (const { id } of STATUS_COMPONENTS.filter((definition) => definition.live)) {
    const judged = judgeLiveComponent(id, run);
    components.push(judged.component);
    histories[id] = judged.history;
  }

  return {
    document: {
      version: STATUS_DOCUMENT_VERSION,
      generatedAt: now.toISOString(),
      components,
      incidents: input.incidents,
      notices: input.notices,
      messagesPerMinute: (input.readings.ingestPublished ?? 0) / INGEST_THROUGHPUT_WINDOW_MINUTES,
    },
    state: {
      version: PUBLISHER_STATE_VERSION,
      lastJudgedAt: isRepeat && previous !== undefined ? previous.lastJudgedAt : now.toISOString(),
      components: histories,
    },
  };
}
