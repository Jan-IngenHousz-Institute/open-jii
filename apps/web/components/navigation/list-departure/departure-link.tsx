"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { useDepartureNavigation } from "./list-departure";

/** Keeps each link's prefetch policy and Next's modified-click/download behavior. */
export function DepartureLink({ onNavigate, ...props }: ComponentProps<typeof Link>) {
  const navigate = useDepartureNavigation(onNavigate);
  return <Link {...props} onNavigate={navigate} />;
}
