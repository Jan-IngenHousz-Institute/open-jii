"use client";

import type { ReactNode } from "react";

import { guestMayUse } from "./guest-access";
import type { GuestGatedProcedure } from "./guest-access";
import { useIsGuest } from "./principal-context";

/** Leaves out what a guest would only reach to be refused. */
export function GuestGate({
  procedure,
  children,
}: {
  procedure: GuestGatedProcedure;
  children: ReactNode;
}) {
  const isGuest = useIsGuest();
  return guestMayUse(procedure, isGuest) ? children : null;
}
