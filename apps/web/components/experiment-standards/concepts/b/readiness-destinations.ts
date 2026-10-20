import type {
  ReadinessOverview,
  ReadinessStep,
} from "@/components/experiment-standards/concepts/readiness-steps";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

/** Destinations in the order a researcher weighs them. */
const DESTINATION_ORDER: StandardId[] = [
  "brapi",
  "miappe",
  "openaire-floor",
  "crop-ontology",
  "common-greenhouse-ontology",
  "ogc-sensorthings",
];

/** FAIR scores a published dataset, so it travels with the destination that publishes one. */
const COMPANION_OF: Partial<Record<StandardId, StandardId>> = { fair: "openaire-floor" };

/** Something a destination needs that the trial already has. */
export type DoneItem = "license-and-funding";

export interface ReadinessDestination {
  readiness: StandardReadiness;
  /** Standards scored at the same destination, shown beside it rather than as cards. */
  companions: StandardReadiness[];
  steps: ReadinessStep[];
  done: DoneItem[];
}

export interface ReadinessDestinations {
  destinations: ReadinessDestination[];
  notApplicable: StandardReadiness[];
}

function doneItems(readiness: StandardReadiness): DoneItem[] {
  // The floor's only trial-side fields are license and funding, so once every missing field comes
  // from a dataset, both are in.
  const isTrialSideFilled =
    readiness.standard === "openaire-floor" && readiness.reason.code === "fields-from-dataset";

  return isTrialSideFilled ? ["license-and-funding"] : [];
}

/** Regroups the readiness rows by where the data can go, each with the steps that move it. */
export function readinessDestinations({
  standards,
  steps,
}: ReadinessOverview): ReadinessDestinations {
  const ordered = DESTINATION_ORDER.flatMap((id) => standards.filter((row) => row.standard === id));

  const toDestination = (readiness: StandardReadiness): ReadinessDestination => {
    const companions = standards.filter((row) => COMPANION_OF[row.standard] === readiness.standard);
    const moved = [readiness.standard, ...companions.map((row) => row.standard)];

    return {
      readiness,
      companions,
      steps: steps.filter((step) => step.standards.some((id) => moved.includes(id))),
      done: doneItems(readiness),
    };
  };

  return {
    destinations: ordered.filter((row) => row.state !== "not-applicable").map(toDestination),
    notApplicable: ordered.filter((row) => row.state === "not-applicable"),
  };
}
