"use client";

import { useProtocolCompatibleMacros } from "@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useMemo, useState } from "react";

import type { ProtocolMacroEntry } from "@repo/api/domains/protocol/protocol.schema";

/**
 * Chips of the macros compatible with a protocol row. Loaded lazily on first
 * hover of the cell (as the overview cards did on card hover) so the overview
 * does not fan out one request per row on mount.
 */
export function CompatibleMacrosCell({ protocolId }: { protocolId: string }) {
  const [hovered, setHovered] = useState(false);
  const { data } = useProtocolCompatibleMacros(protocolId, hovered);
  const macros: ProtocolMacroEntry[] = useMemo(() => data ?? [], [data]);

  return (
    <div
      className="flex min-h-4 w-full flex-wrap gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {macros.map((entry) => (
        <span
          key={entry.macro.id}
          className="bg-muted text-muted-foreground inline-block max-w-40 truncate rounded px-1.5 py-0.5 text-[11px]"
        >
          {entry.macro.name}
        </span>
      ))}
    </div>
  );
}
