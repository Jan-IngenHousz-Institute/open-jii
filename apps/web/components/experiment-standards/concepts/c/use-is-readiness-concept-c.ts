"use client";

import { useSearchParams } from "next/navigation";

/** Scaffold: the hints of readiness Concept C show only when the address carries ?readiness=c. */
export function useIsReadinessConceptC(): boolean {
  return useSearchParams().get("readiness") === "c";
}
