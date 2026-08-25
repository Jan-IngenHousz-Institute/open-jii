"use client";

import { useMacroCompatibleProtocols } from "@/hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useMemo, useState } from "react";

import type { MacroProtocolEntry } from "@repo/api/domains/macro/macro.schema";

/**
 * Chips of the protocols compatible with a macro row. Loaded lazily on first
 * hover of the cell (as the overview cards did on card hover) so the overview
 * does not fan out one request per row on mount.
 */
export function CompatibleProtocolsCell({ macroId }: { macroId: string }) {
  const [hovered, setHovered] = useState(false);
  const { data } = useMacroCompatibleProtocols(macroId, hovered);
  const protocols: MacroProtocolEntry[] = useMemo(() => data ?? [], [data]);

  return (
    <div
      className="flex min-h-4 w-full flex-wrap gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {protocols.map((entry) => (
        <span
          key={entry.protocol.id}
          className="inline-block max-w-40 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
        >
          {entry.protocol.name}
        </span>
      ))}
    </div>
  );
}
