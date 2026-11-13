import { z } from "zod/mini";

import { STATUS_COMPONENTS } from "./status-components.js";
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

/**
 * One bad minute is often a cold start, a dropped request or a pipeline restarting, so degraded
 * needs two in a row. Grafana's alerts wait in the same way before they fire.
 */
export const MINUTES_FOR_DEGRADED = 2;

/** One failed minute is often the network between us and the service, three in a row is the service. */
export const MINUTES_FOR_OUTAGE = 3;

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

export const PUBLISHER_STATE_VERSION = 2;

const componentHistorySchema = z.object({
  /** Minutes in a row the checks read degraded or worse, up to and including the last judged minute. */
  degradedStreak: z.int().check(z.nonnegative()),
  /** Minutes in a row the checks read an outage, counted like `degradedStreak`. */
  outageStreak: z.int().check(z.nonnegative()),
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
  /** This minute's probes; a component without its own ignores them. */
  probes: StatusProbes;
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

function judgeWebsite({ probes, readings }: ComponentEvidence): ComponentVerdict {
  const requests = readings.websiteRequests ?? 0;
  const failedRequests = readings.websiteFailedRequests ?? 0;

  const isUnreachable = !probes.website.ok;
  const isServingErrors =
    requests >= WEBSITE_MIN_REQUESTS &&
    failedRequests * 100 > requests * WEBSITE_OUTAGE_ERROR_PERCENT;
  const isSlow = probes.website.durationMs > WEBSITE_SLOW_PROBE_MS;

  return { state: stateOf(isUnreachable || isServingErrors, isSlow) };
}

function judgePlatform({ probes, readings }: ComponentEvidence): ComponentVerdict {
  const errors = (readings.albElb5xx ?? 0) + (readings.albTarget5xx ?? 0);
  const requests = readings.albRequests ?? 0;

  const isUnreachable = !probes.platform.ok;
  const isErroring =
    errors >= PLATFORM_MIN_ERRORS && errors > requests * PLATFORM_OUTAGE_ERROR_SHARE;
  const isDatabaseDown = isDependencyDown(readings.databaseUp);
  const isSlow = probes.platform.durationMs > PLATFORM_SLOW_PROBE_MS;
  const isDatabricksDown = isDependencyDown(readings.databricksUp);

  return {
    state: stateOf(isUnreachable || isDatabaseDown || isErroring, isSlow || isDatabricksDown),
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

/** The worst state any rule of the component reaches in this one minute, before it has held long enough to show. */
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
  /** Minutes were skipped since the last judged one, so no streak spans them. */
  isAfterGap: boolean;
}

type StateStreaks = Pick<ComponentHistory, "degradedStreak" | "outageStreak">;

const NO_STREAKS: StateStreaks = { degradedStreak: 0, outageStreak: 0 };

function nextStreaks(
  previous: StateStreaks,
  judged: MeasuredState,
  isRepeat: boolean,
): StateStreaks {
  if (isRepeat) {
    return previous;
  }

  return {
    degradedStreak: judged === "operational" ? 0 : previous.degradedStreak + 1,
    outageStreak: judged === "outage" ? previous.outageStreak + 1 : 0,
  };
}

function confirmedState({ degradedStreak, outageStreak }: StateStreaks): MeasuredState {
  return stateOf(outageStreak >= MINUTES_FOR_OUTAGE, degradedStreak >= MINUTES_FOR_DEGRADED);
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
    : { degradedStreak: history?.degradedStreak ?? 0, outageStreak: history?.outageStreak ?? 0 };

  const verdict = judgeComponent(id, { probes: run.probes, readings: run.readings });
  const streaks = nextStreaks(carried, verdict.state, run.isRepeat);
  const confirmed = confirmedState(streaks);

  const open = run.incidents.filter(
    (incident) => incident.components.includes(id) && isOpen(incident, run.now.getTime()),
  );
  const incidentImpacts = open
    .filter((incident) => incident.kind === "incident")
    .map((incident) => incident.impact);
  const measured = worstState([confirmed, ...incidentImpacts]);
  const isUnderMaintenance = open.some((incident) => incident.kind === "maintenance");
  const state = isUnderMaintenance ? "maintenance" : measured;
  const days = advanceDays(history, run, state);
  const delayMinutes = confirmed === "operational" ? undefined : verdict.delayMinutes;

  const component: StatusComponent = {
    id,
    state,
    ...(delayMinutes === undefined ? {} : { delayMinutes }),
    uptimePercent: uptimePercent(days),
    degradedMinutes: totalDegradedMinutes(days),
    days,
  };

  return { component, history: { ...streaks, days } };
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
    },
    state: {
      version: PUBLISHER_STATE_VERSION,
      lastJudgedAt: isRepeat && previous !== undefined ? previous.lastJudgedAt : now.toISOString(),
      components: histories,
    },
  };
}
