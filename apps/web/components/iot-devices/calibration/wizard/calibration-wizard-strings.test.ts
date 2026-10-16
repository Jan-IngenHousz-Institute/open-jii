import { describe, expect, it } from "vitest";

import deIot from "@repo/i18n/locales/de-DE/iot.json";
import enIot from "@repo/i18n/locales/en-US/iot.json";
import nlIot from "@repo/i18n/locales/nl-NL/iot.json";

/**
 * Locale coverage for strings the wizard builds from a name or a count. The test setup's `t`
 * returns the key it is given, so a missing label or plural form passes every component test
 * and only shows on screen, as the raw key.
 */
const BUNDLES = [
  ["en-US", enIot],
  ["de-DE", deIot],
  ["nl-NL", nlIot],
] satisfies [string, typeof enIot][];

const WIZARD_STEPS = ["choose", "connect", "capture", "recorded", "review", "write", "done"];

const DONE_COUNTS = ["readingCount", "seriesCount", "appliedValue", "onDeviceValue"];

describe.each(BUNDLES)("calibration wizard strings in %s", (locale, bundle) => {
  const steps: Record<string, string | undefined> = bundle.iot.calibration.steps;
  const done: Record<string, string | undefined> = bundle.iot.calibration.done;

  it.each(WIZARD_STEPS)("labels the %s step", (step) => {
    expect(steps[step]?.trim(), `${locale} is missing steps.${step}`).toBeTruthy();
  });

  it.each(DONE_COUNTS)("has both plural forms of done.%s", (key) => {
    expect(done[`${key}_one`], `${locale} is missing done.${key}_one`).toContain("{{count}}");
    expect(done[`${key}_other`], `${locale} is missing done.${key}_other`).toContain("{{count}}");
  });

  it("composes the measured line from its two counts", () => {
    expect(done.measuredValue).toContain("{{readings}}");
    expect(done.measuredValue).toContain("{{series}}");
  });
});
