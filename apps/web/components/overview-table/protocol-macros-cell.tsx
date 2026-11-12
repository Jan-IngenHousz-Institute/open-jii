"use client";

import { useProtocolCompatibleMacros } from "@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";

export function CompatibleMacrosCell({
  protocolId,
  compatibleMacroCount = 0,
}: {
  protocolId: string;
  compatibleMacroCount?: number;
}) {
  const { t } = useTranslation("common");
  const [revealed, setRevealed] = useState(false);
  const { data, isError, refetch } = useProtocolCompatibleMacros(
    protocolId,
    revealed && compatibleMacroCount > 0,
  );

  const showChips = revealed && data !== undefined && !isError && data.length > 0;

  if (compatibleMacroCount === 0) return <span>–</span>;

  return (
    <button
      type="button"
      aria-label={
        showChips
          ? undefined
          : t("protocols.columns.macroCountLabel", { count: compatibleMacroCount })
      }
      className="focus-visible:ring-primary/40 focus-visible:outline-hidden flex min-h-4 w-full flex-wrap gap-1 rounded text-left focus-visible:ring-2"
      onMouseEnter={() => setRevealed(true)}
      onFocus={() => setRevealed(true)}
      onClick={(event) => {
        event.stopPropagation();
        setRevealed(true);
        if (isError) void refetch();
      }}
    >
      {showChips ? (
        data.map((entry) => (
          <span
            key={entry.macro.id}
            title={entry.macro.name}
            className="bg-muted text-muted-foreground inline-block max-w-40 truncate rounded px-1.5 py-0.5 text-[11px]"
          >
            {entry.macro.name}
          </span>
        ))
      ) : (
        <span className="bg-muted text-muted-foreground inline-block rounded px-1.5 py-0.5 text-[11px]">
          {t("protocols.columns.macroCount", { count: compatibleMacroCount })}
        </span>
      )}
    </button>
  );
}
