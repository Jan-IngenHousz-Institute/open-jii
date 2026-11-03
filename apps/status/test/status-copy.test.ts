import { describe, expect, it } from "vitest";

import en from "@repo/i18n/locales/en-US/status.json";
import {
  MACRO_FAILURE_WINDOW_MINUTES,
  PIPELINE_WINDOW_MINUTES,
  RULE_WINDOW_MINUTES,
} from "@repo/monitoring/status-components";
import { DAY_DEGRADED_MINUTES } from "@repo/monitoring/status-history";
import {
  BAD_PROBES_FOR_DEGRADED,
  DELIVERY_DEGRADED_LATENCY_MINUTES,
  DELIVERY_OUTAGE_LATENCY_MINUTES,
  INGEST_OUTAGE_FAILURES,
  ITERATOR_AGE_DEGRADED_MINUTES,
  MACRO_DEGRADED_LATENCY_MINUTES,
  MACRO_OUTAGE_LATENCY_MINUTES,
  PLATFORM_MIN_ERRORS,
  PLATFORM_OUTAGE_ERROR_SHARE,
  PLATFORM_SLOW_PROBE_MS,
  PROBE_FAILURES_FOR_OUTAGE,
  WEBSITE_MIN_REQUESTS,
  WEBSITE_OUTAGE_ERROR_PERCENT,
  WEBSITE_SLOW_PROBE_MS,
} from "@repo/monitoring/status-judge";

const COUNT_WORDS = new Map([
  [2, "two"],
  [3, "three"],
  [5, "five"],
]);

// The copy spells out small counts and writes the rest as digits.
function count(value: number) {
  return COUNT_WORDS.get(value) ?? String(value);
}

function span(minutes: number) {
  return minutes === 60 ? "an hour" : `${minutes} minutes`;
}

function recent(minutes: number) {
  return minutes === 60 ? "the last hour" : `the last ${minutes} minutes`;
}

function seconds(milliseconds: number) {
  return `${milliseconds / 1000} seconds`;
}

function digitsIn(text: string) {
  return [...new Set(text.match(/\d+/g) ?? [])].sort();
}

const CASES: [string, string, string[]][] = [
  [
    "website",
    en.component.website.details,
    [
      `${count(BAD_PROBES_FOR_DEGRADED)} slow or failed checks in a row`,
      `slow if it takes more than ${seconds(WEBSITE_SLOW_PROBE_MS)}`,
      `${count(PROBE_FAILURES_FOR_OUTAGE)} failed checks in a row`,
      `in ${recent(RULE_WINDOW_MINUTES)}, at least ${WEBSITE_MIN_REQUESTS} requests`,
      "more than half of them failed",
    ],
  ],
  [
    "platform",
    en.component.platform.details,
    [
      `${count(BAD_PROBES_FOR_DEGRADED)} slow or failed test requests in a row`,
      `slow if it takes more than ${seconds(PLATFORM_SLOW_PROBE_MS)}`,
      `${count(PROBE_FAILURES_FOR_OUTAGE)} failed test requests in a row`,
      `in ${recent(RULE_WINDOW_MINUTES)}, at least ${PLATFORM_MIN_ERRORS} requests ended in a server error`,
      "more than half of all requests",
    ],
  ],
  [
    "data intake",
    en.component["data-intake"].details,
    [
      `when, in ${recent(RULE_WINDOW_MINUTES)}`,
      `more than ${count(INGEST_OUTAGE_FAILURES)} measurements could not be stored in ${recent(RULE_WINDOW_MINUTES)}`,
    ],
  ],
  [
    "data delivery",
    en.component["data-delivery"].details,
    [
      `took more than ${span(DELIVERY_DEGRADED_LATENCY_MINUTES)}`,
      `more than ${span(ITERATOR_AGE_DEGRADED_MINUTES)} behind`,
      `it took more than ${span(DELIVERY_OUTAGE_LATENCY_MINUTES)}`,
      `has not reported for ${span(PIPELINE_WINDOW_MINUTES)}`,
    ],
  ],
  [
    "macro processing",
    en.component["macro-processing"].details,
    [
      `failed in ${recent(MACRO_FAILURE_WINDOW_MINUTES)}`,
      `more than ${span(MACRO_DEGRADED_LATENCY_MINUTES)} after their measurements`,
      `more than ${span(MACRO_OUTAGE_LATENCY_MINUTES)} after their measurements`,
    ],
  ],
  ["exports", en.component.exports.details, [`in ${recent(MACRO_FAILURE_WINDOW_MINUTES)}`]],
];

describe("the en-US component details", () => {
  it.each(CASES)("%s quotes the judge's thresholds", (_name, details, phrases) => {
    for (const phrase of phrases) {
      expect(details).toContain(phrase);
    }
  });

  it.each(CASES)("%s holds no number the judge does not set", (_name, details, phrases) => {
    expect(digitsIn(details)).toEqual(digitsIn(phrases.join(" ")));
  });

  it("says more than half where the judge compares against half", () => {
    expect(WEBSITE_OUTAGE_ERROR_PERCENT).toBe(50);
    expect(PLATFORM_OUTAGE_ERROR_SHARE).toBe(0.5);
  });
});

describe("the en-US measuring notes", () => {
  it("marks a day Degraded from the minutes the history sets", () => {
    expect(en.howWeMeasure.uptime).toContain(
      `marked Degraded from ${count(DAY_DEGRADED_MINUTES)} degraded minutes`,
    );
  });
});
