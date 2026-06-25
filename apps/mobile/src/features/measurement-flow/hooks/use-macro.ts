import { useMemo } from "react";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { deriveMacroFilename } from "~/features/measurement-flow/utils/derive-macro-filename";

export interface ResolvedMacro {
  id: string;
  name: string;
  filename: string;
  language: string;
  code: string;
}

/**
 * The macro metadata the analysis step uploads, assembled offline from the
 * workbook cell (id, name, language) + the version snapshot (code) + a derived
 * filename. filename is a pure hash of the id (deriveMacroFilename), so there's
 * no need to fetch the live macro row.
 */
export function useMacro(macroId: string | undefined) {
  const cell = useMeasurementFlowStore((s) =>
    macroId ? s.cells.find((c) => c.type === "macro" && c.payload.macroId === macroId) : undefined,
  );
  const code = useMeasurementFlowStore((s) =>
    macroId ? s.entitySnapshots?.macros[macroId]?.code : undefined,
  );

  const macro = useMemo<ResolvedMacro | undefined>(() => {
    if (!macroId || cell?.type !== "macro") return undefined;
    return {
      id: macroId,
      // Cosmetic macro_name metadata; fall back to the filename when the cell
      // omits a display name.
      name: cell.payload.name ?? deriveMacroFilename(macroId),
      filename: deriveMacroFilename(macroId),
      language: cell.payload.language,
      code: code ?? "",
    };
  }, [macroId, cell, code]);

  return { macro, isLoading: false, error: undefined };
}
