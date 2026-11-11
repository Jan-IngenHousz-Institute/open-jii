"use client";

import { useMacroCompatibleProtocols } from "@/hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";

export function CompatibleProtocolsCell({
  macroId,
  compatibleProtocolCount = 0,
}: {
  macroId: string;
  compatibleProtocolCount?: number;
}) {
  const { t } = useTranslation("macro");
  const [revealed, setRevealed] = useState(false);
  const { data, isError } = useMacroCompatibleProtocols(
    macroId,
    revealed && compatibleProtocolCount > 0,
  );

  const showChips = revealed && data !== undefined && !isError && data.length > 0;

  if (compatibleProtocolCount === 0) return <span>–</span>;

  return (
    <button
      type="button"
      aria-label={
        showChips
          ? undefined
          : t("macros.columns.protocolCountLabel", { count: compatibleProtocolCount })
      }
      className="focus-visible:ring-primary/40 focus-visible:outline-hidden flex min-h-4 w-full flex-wrap gap-1 rounded text-left focus-visible:ring-2"
      onMouseEnter={() => setRevealed(true)}
      onFocus={() => setRevealed(true)}
      onClick={(event) => {
        event.stopPropagation();
        setRevealed(true);
      }}
    >
      {showChips ? (
        data.map((entry) => (
          <span
            key={entry.protocol.id}
            title={entry.protocol.name}
            className="bg-muted text-muted-foreground inline-block max-w-40 truncate rounded px-1.5 py-0.5 text-[11px]"
          >
            {entry.protocol.name}
          </span>
        ))
      ) : (
        <span className="bg-muted text-muted-foreground inline-block rounded px-1.5 py-0.5 text-[11px]">
          {t("macros.columns.protocolCount", { count: compatibleProtocolCount })}
        </span>
      )}
    </button>
  );
}
