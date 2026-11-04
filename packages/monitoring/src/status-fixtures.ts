import { STATUS_DOCUMENT_VERSION } from "./status-document.js";
import type {
  ComponentState,
  DayRecord,
  Incident,
  StatusComponent,
  StatusComponentId,
  StatusDocument,
} from "./status-document.js";
import {
  DAY_DEGRADED_MINUTES,
  dayState,
  totalDegradedMinutes,
  uptimePercent,
} from "./status-history.js";

const FIRST_DAY_UTC = Date.UTC(2026, 7, 6);
const DAYS = 90;
const TODAY = "2026-11-03";
/** Minutes of today recorded at the fixtures' noon, the minute of noon included. */
const MINUTES_TODAY = 721;
/** Checks that began mid-day record only the rest of their first day. */
const FIRST_CHECKED_DAY_MINUTES = 780;

const GENERATED_AT = "2026-11-03T12:00:00.000Z";
const STALE_GENERATED_AT = "2026-11-03T11:40:00.000Z";

interface DaySpec {
  recorded?: number;
  down?: number;
  degraded?: number;
  maintenance?: number;
  unknown?: number;
  incidentIds?: string[];
}

function dateOfDay(index: number): string {
  return new Date(FIRST_DAY_UTC + index * 86_400_000).toISOString().slice(0, 10);
}

function day(date: string, spec: DaySpec): DayRecord {
  const counts = {
    recordedMinutes: spec.recorded ?? 1440,
    downMinutes: spec.down ?? 0,
    degradedMinutes: spec.degraded ?? 0,
    maintenanceMinutes: spec.maintenance ?? 0,
    unknownMinutes: spec.unknown ?? 0,
  };

  return { date, ...counts, state: dayState(counts), incidentIds: spec.incidentIds ?? [] };
}

/**
 * Days from `firstIndex` to today, every minute operational except where `specs` says otherwise.
 * The document keeps days only from a component's first record, so none are padded before it.
 */
function daysSince(specs: Record<string, DaySpec>, firstIndex = 0): DayRecord[] {
  return Array.from({ length: DAYS - firstIndex }, (_, offset) => {
    const date = dateOfDay(firstIndex + offset);
    const isFirstCheckedDay = firstIndex > 0 && offset === 0;
    const recorded =
      date === TODAY ? MINUTES_TODAY : isFirstCheckedDay ? FIRST_CHECKED_DAY_MINUTES : undefined;
    return day(date, { recorded, ...specs[date] });
  });
}

function component(
  id: StatusComponentId,
  state: ComponentState,
  days: DayRecord[],
  delayMinutes?: number,
): StatusComponent {
  return {
    id,
    state,
    ...(delayMinutes === undefined ? {} : { delayMinutes }),
    uptimePercent: uptimePercent(days),
    degradedMinutes: totalDegradedMinutes(days),
    days,
  };
}

const websiteSpecs: Record<string, DaySpec> = {
  "2026-09-14": { degraded: 18 },
  "2026-10-02": { down: 42, degraded: 9 },
};

const platformSpecs: Record<string, DaySpec> = {
  "2026-08-21": { degraded: 95 },
  "2026-09-12": { degraded: DAY_DEGRADED_MINUTES - 1 },
  "2026-09-30": { maintenance: 60 },
  "2026-10-18": { down: 12, degraded: 20 },
};

const dataIntakeSpecs: Record<string, DaySpec> = {
  "2026-09-05": { degraded: 30 },
  "2026-10-09": { down: 25, unknown: 4 },
};

const dataDeliverySpecs: Record<string, DaySpec> = {
  "2026-09-23": { degraded: 240 },
  "2026-10-14": { degraded: 180 },
  "2026-10-15": { down: 55, degraded: 70 },
};

const macroProcessingSpecs: Record<string, DaySpec> = {
  "2026-09-23": { degraded: 60 },
  "2026-10-12": { degraded: 330, maintenance: 30 },
};

/** Days before the macro pipeline was checked, which the page pads as "no record". */
const MACRO_DAYS_BEFORE_CHECKS = 6;

function document(
  generatedAt: string,
  components: StatusComponent[],
  incidents: Incident[],
  messagesPerMinute: number,
): StatusDocument {
  return {
    version: STATUS_DOCUMENT_VERSION,
    generatedAt,
    components,
    incidents,
    notices: [],
    messagesPerMinute,
  };
}

function healthyComponents(): StatusComponent[] {
  return [
    component("website", "operational", daysSince(websiteSpecs)),
    component("platform", "operational", daysSince(platformSpecs)),
    component("data-intake", "operational", daysSince(dataIntakeSpecs)),
    component("data-delivery", "operational", daysSince(dataDeliverySpecs)),
    component(
      "macro-processing",
      "operational",
      daysSince(macroProcessingSpecs, MACRO_DAYS_BEFORE_CHECKS),
    ),
  ];
}

export const operationalStatusDocument: StatusDocument = document(
  GENERATED_AT,
  healthyComponents(),
  [],
  42.6,
);

/** The same document, written twenty minutes earlier, for the page's stale-data banner. */
export const staleStatusDocument: StatusDocument = document(
  STALE_GENERATED_AT,
  healthyComponents(),
  [],
  42.6,
);

const incident: Incident = {
  id: "2026-11-03-measurements-delayed",
  kind: "incident",
  title: "Measurements are not reaching the platform",
  impact: "outage",
  components: ["data-intake", "data-delivery"],
  startsAt: "2026-11-03T11:22:00.000Z",
  updates: [
    {
      stage: "investigating",
      postedAt: "2026-11-03T11:25:00.000Z",
      text: "Measurements sent from devices are not being stored. We are looking into it.",
      nextUpdateBy: "2026-11-03T11:55:00.000Z",
    },
    {
      stage: "identified",
      postedAt: "2026-11-03T11:48:00.000Z",
      text: "The step that stores incoming measurements stopped. Nothing is lost: devices keep their data and send it again once it is back.",
      nextUpdateBy: "2026-11-03T12:20:00.000Z",
    },
  ],
};

const INCIDENT_MINUTES = 38;

export const incidentStatusDocument: StatusDocument = document(
  GENERATED_AT,
  [
    component("website", "operational", daysSince(websiteSpecs)),
    component("platform", "operational", daysSince(platformSpecs)),
    component(
      "data-intake",
      "outage",
      daysSince({
        ...dataIntakeSpecs,
        [TODAY]: { down: INCIDENT_MINUTES, incidentIds: [incident.id] },
      }),
    ),
    component(
      "data-delivery",
      "degraded",
      daysSince({
        ...dataDeliverySpecs,
        [TODAY]: { degraded: INCIDENT_MINUTES, incidentIds: [incident.id] },
      }),
      27,
    ),
    component(
      "macro-processing",
      "operational",
      daysSince(macroProcessingSpecs, MACRO_DAYS_BEFORE_CHECKS),
    ),
  ],
  [incident],
  3.2,
);

export const resolvedIncident: Incident = {
  id: "2026-10-28-delivery-delay",
  kind: "incident",
  title: "Measurements were slow to appear in experiments",
  impact: "degraded",
  components: ["data-delivery"],
  startsAt: "2026-10-28T09:10:00.000Z",
  resolvedAt: "2026-10-28T09:52:00.000Z",
  updates: [
    {
      stage: "investigating",
      postedAt: "2026-10-28T09:15:00.000Z",
      text: "New measurements are taking longer than usual to appear. We are looking into it.",
    },
    {
      stage: "resolved",
      postedAt: "2026-10-28T09:52:00.000Z",
      text: "From 09:10 to 09:52 UTC, new measurements took up to 25 minutes to appear. Nothing was lost.",
    },
  ],
};

export const completedMaintenance: Incident = {
  id: "2026-10-03-maintenance",
  kind: "maintenance",
  title: "Planned maintenance",
  impact: "outage",
  components: ["website", "platform"],
  startsAt: "2026-10-03T07:00:00.000Z",
  endsAt: "2026-10-03T08:10:00.000Z",
  resolvedAt: "2026-10-03T08:10:00.000Z",
  updates: [
    {
      stage: "scheduled",
      postedAt: "2026-09-26T10:00:00.000Z",
      text: "The website and the platform will not work during the window.",
    },
    {
      stage: "completed",
      postedAt: "2026-10-03T08:10:00.000Z",
      text: "The website and the platform were unavailable from 07:00 to 08:10 UTC, as announced a week ahead.",
    },
  ],
};

export const upcomingMaintenance: Incident = {
  id: "2026-11-07-maintenance",
  kind: "maintenance",
  title: "Planned maintenance",
  impact: "outage",
  components: ["website", "platform"],
  startsAt: "2026-11-07T07:00:00.000Z",
  endsAt: "2026-11-07T09:00:00.000Z",
  updates: [
    {
      stage: "scheduled",
      postedAt: "2026-10-31T10:00:00.000Z",
      text: "The website and the platform will not work. The field app keeps collecting measurements and uploads them once the work ends. If you need to export data, do it before 07:00 UTC.",
    },
  ],
};

/** Operational, with a resolved incident, a completed and an upcoming maintenance window, and a notice. */
export const plannedStatusDocument: StatusDocument = {
  ...document(
    GENERATED_AT,
    [
      component(
        "website",
        "operational",
        daysSince({
          ...websiteSpecs,
          "2026-10-03": { maintenance: 70, incidentIds: [completedMaintenance.id] },
        }),
      ),
      component(
        "platform",
        "operational",
        daysSince({
          ...platformSpecs,
          "2026-10-03": { maintenance: 70, incidentIds: [completedMaintenance.id] },
        }),
      ),
      component("data-intake", "operational", daysSince(dataIntakeSpecs)),
      component(
        "data-delivery",
        "operational",
        daysSince({
          ...dataDeliverySpecs,
          "2026-10-28": { degraded: 42, incidentIds: [resolvedIncident.id] },
        }),
      ),
      component(
        "macro-processing",
        "operational",
        daysSince(macroProcessingSpecs, MACRO_DAYS_BEFORE_CHECKS),
      ),
    ],
    [upcomingMaintenance, resolvedIncident, completedMaintenance],
    42.6,
  ),
  notices: [
    {
      id: "2026-11-field-app",
      title: "Field app update available",
      body: "Version 1.8 of the field app is out. Update it before your next field trip.",
      severity: "info",
    },
  ],
};

export const maintenanceInProgress: Incident = {
  id: "2026-11-03-maintenance",
  kind: "maintenance",
  title: "Planned maintenance",
  impact: "outage",
  components: ["website", "platform"],
  startsAt: "2026-11-03T11:00:00.000Z",
  endsAt: "2026-11-03T13:00:00.000Z",
  updates: [
    {
      stage: "in-progress",
      postedAt: "2026-11-03T11:00:00.000Z",
      text: "The website and the platform will not work until the window ends. The field app keeps collecting measurements and uploads them afterwards.",
    },
  ],
};

const MAINTENANCE_MINUTES = 61;

/** A window is open on the website and the platform, which carry "maintenance" while it lasts. */
export const maintenanceStatusDocument: StatusDocument = document(
  GENERATED_AT,
  [
    component(
      "website",
      "maintenance",
      daysSince({
        ...websiteSpecs,
        [TODAY]: { maintenance: MAINTENANCE_MINUTES, incidentIds: [maintenanceInProgress.id] },
      }),
    ),
    component(
      "platform",
      "maintenance",
      daysSince({
        ...platformSpecs,
        [TODAY]: { maintenance: MAINTENANCE_MINUTES, incidentIds: [maintenanceInProgress.id] },
      }),
    ),
    component("data-intake", "operational", daysSince(dataIntakeSpecs)),
    component("data-delivery", "operational", daysSince(dataDeliverySpecs)),
    component(
      "macro-processing",
      "operational",
      daysSince(macroProcessingSpecs, MACRO_DAYS_BEFORE_CHECKS),
    ),
  ],
  [maintenanceInProgress],
  42.6,
);
