"use client";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

import type { ReadinessOverview } from "../readiness-steps";
import { useListJoin } from "./use-list-join";

/**
 * Where a trial's data can go, in words that fit a sentence. A standard that scores or names
 * things leads nowhere by itself, so it has no place.
 */
const PLACE_KEYS: Record<StandardId, readonly string[]> = {
  brapi: ["place.breedingTools"],
  miappe: ["place.repositories"],
  "openaire-floor": ["place.doi", "place.openaire"],
  "ogc-sensorthings": ["place.sensorPlatforms"],
  fair: [],
  "crop-ontology": [],
  "common-greenhouse-ontology": [],
};

export interface ReadinessSentence {
  /** Where the trial can go today, or null when it can go nowhere yet. */
  ready: string | null;
  remaining: string;
}

/** The strip's sentence: where the trial is ready for, and how far the rest is. */
export function useReadinessSentence({ standards, steps }: ReadinessOverview): ReadinessSentence {
  const { t } = useTranslation("readinessConceptC");
  const joinList = useListJoin();

  const placesOf = (ids: readonly StandardId[]) =>
    [...new Set(ids.flatMap((id) => PLACE_KEYS[id]))].map((key) => t(key));

  const readyPlaces = placesOf(
    standards.filter((row) => row.state === "met").map((row) => row.standard),
  );
  const pendingPlaces = placesOf(steps.flatMap((step) => step.standards));

  const remaining = () => {
    if (steps.length === 0) {
      return t("strip.nothingLeft");
    }
    if (pendingPlaces.length === 0) {
      return t("strip.stepsLeft", { count: steps.length });
    }
    return t("strip.stepsFrom", { count: steps.length, places: joinList(pendingPlaces) });
  };

  return {
    ready: readyPlaces.length > 0 ? t("strip.ready", { places: joinList(readyPlaces) }) : null,
    remaining: remaining(),
  };
}
