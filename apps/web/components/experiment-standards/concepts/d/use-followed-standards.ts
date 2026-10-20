import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { zStandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";

/** Publishing always meets the OpenAIRE floor, so every trial follows it. */
export const REQUIRED_STANDARD: StandardId = "openaire-floor";

const DEFAULT_FOLLOWED: StandardId[] = ["miappe", "crop-ontology", REQUIRED_STANDARD];

function isStandardId(value: string): value is StandardId {
  return zStandardId.safeParse(value).success;
}

/**
 * The standards this trial follows. Production stores the choice on the experiment; the scaffold
 * holds it in client state, seeded from `?follow=`.
 */
export function useFollowedStandards() {
  const follow = useSearchParams().get("follow");

  const [followed, setFollowed] = useState<StandardId[]>(() => {
    if (follow === null) {
      return DEFAULT_FOLLOWED;
    }

    const chosen = follow.split(",").filter(isStandardId);
    return chosen.includes(REQUIRED_STANDARD) ? chosen : [...chosen, REQUIRED_STANDARD];
  });

  return { followed, setFollowed };
}
