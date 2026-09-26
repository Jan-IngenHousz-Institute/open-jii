import { describe, expect, it } from "vitest";
import enUS from "~/shared/i18n/locales/en-US/experiments.json";
import nlNL from "~/shared/i18n/locales/nl-NL/experiments.json";

import { zExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";

import { experimentStatusLabelKey } from "./experiment-status-label";

function hasKey(bundle: Record<string, unknown>, path: string): boolean {
  const value = path.split(".").reduce<unknown>((node, segment) => {
    return node && typeof node === "object"
      ? (node as Record<string, unknown>)[segment]
      : undefined;
  }, bundle);
  return typeof value === "string" && value.length > 0;
}

describe("experimentStatusLabelKey", () => {
  it("returns null for active, the case that needs no tag", () => {
    expect(experimentStatusLabelKey("active")).toBeNull();
  });

  it.each(zExperimentStatus.options.filter((s) => s !== "active"))(
    "qualifies %s with the experiments namespace",
    (status) => {
      expect(experimentStatusLabelKey(status)).toMatch(/^experiments:status\./u);
    },
  );

  it.each(zExperimentStatus.options.filter((s) => s !== "active"))(
    "has a translation for %s in both locales",
    (status) => {
      const path = (experimentStatusLabelKey(status) ?? "").replace(/^experiments:/u, "");

      expect(hasKey(enUS, path)).toBe(true);
      expect(hasKey(nlNL, path)).toBe(true);
    },
  );

  it("covers every status the contract defines, so a new one cannot slip through", () => {
    const labelled = zExperimentStatus.options.filter(
      (status) => experimentStatusLabelKey(status) !== null,
    );

    expect(labelled).toEqual(["stale", "archived", "published"]);
  });
});
