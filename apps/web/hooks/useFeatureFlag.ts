"use client";

import { useFeatureFlagEnabled as usePosthogFlag } from "posthog-js/react";

import type { FeatureFlagKey } from "@repo/analytics";
import { isFlagForcedOn } from "@repo/analytics";

/**
 * PostHog's client hook plus the local-dev force switch
 * (`NEXT_PUBLIC_FEATURE_FLAGS_FORCE`, inlined at build). Semantics otherwise
 * identical: `undefined` while PostHog has not answered yet.
 */
export function useFeatureFlagEnabled(flagKey: FeatureFlagKey): boolean | undefined {
  const remote = usePosthogFlag(flagKey);

  if (isFlagForcedOn(flagKey)) {
    return true;
  }

  return remote;
}
