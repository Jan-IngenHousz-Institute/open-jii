"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@repo/ui/lib/utils";

import type { ResolvedEntity } from "./resolve-entity-label";

/**
 * An entity the device referenced. Links out when the viewer can actually open
 * it; otherwise it renders as muted text, since a dead link to something the
 * viewer has no access to is worse than plain text.
 */
export function EntityLink({ entity, className }: { entity: ResolvedEntity; className?: string }) {
  if (entity.href === null) {
    return <span className={cn("text-muted-foreground italic", className)}>{entity.label}</span>;
  }

  return (
    <Link
      href={entity.href}
      className={cn("inline-flex items-center gap-1 font-medium hover:underline", className)}
    >
      {entity.label}
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}
