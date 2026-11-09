import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { DayRowKind } from "~/components/history/day-summary";
import { HISTORY_LEGEND } from "~/components/history/history-cells";
import type { StatusBadge } from "~/components/shared/status-badge";

import en from "@repo/i18n/locales/en-US/status.json";
import { STATUS_COMPONENT_IDS } from "@repo/monitoring/status-document";
import type { Incident } from "@repo/monitoring/status-document";

// A record per union, so a member added to the union fails the typecheck until it is listed here.
const BADGE_STATES: Record<ComponentProps<typeof StatusBadge>["state"], true> = {
  operational: true,
  degraded: true,
  outage: true,
  maintenance: true,
  resolved: true,
  scheduled: true,
  "in-progress": true,
  completed: true,
};

const DAY_ROW_KINDS: Record<DayRowKind, true> = {
  outage: true,
  degraded: true,
  maintenance: true,
  unknown: true,
};

const INCIDENT_STAGES: Record<Incident["updates"][number]["stage"], true> = {
  investigating: true,
  identified: true,
  monitoring: true,
  resolved: true,
  scheduled: true,
  "in-progress": true,
  completed: true,
};

function copyOf(key: string): unknown {
  let node: unknown = en;

  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !Object.hasOwn(node, part)) {
      return undefined;
    }
    node = Reflect.get(node, part);
  }

  return node;
}

const KEYS = [
  ...STATUS_COMPONENT_IDS.flatMap((id) =>
    ["name", "description", "details"].map((field) => `component.${id}.${field}`),
  ),
  ...Object.keys(BADGE_STATES).map((state) => `badge.${state}`),
  ...HISTORY_LEGEND.map((state) => `legend.${state}`),
  ...Object.keys(DAY_ROW_KINDS).flatMap((kind) => [`day.row.${kind}`, `day.aria.${kind}`]),
  ...Object.keys(INCIDENT_STAGES).map((stage) => `incident.stage.${stage}`),
];

describe("the keys the page builds from values", () => {
  it.each(KEYS)("%s has en-US copy", (key) => {
    expect(copyOf(key)).toEqual(expect.any(String));
  });
});
