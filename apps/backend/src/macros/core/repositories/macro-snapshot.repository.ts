import { Inject, Injectable } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import { inArray, workbookVersions } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import type { Result } from "../../../common/utils/fp-utils";
import { success, tryCatch } from "../../../common/utils/fp-utils";
import type { MacroScript } from "../models/macro.model";
import { CACHE_PORT, CachePort } from "../ports/cache.port";

type MacroSnapshotBundle = Record<string, MacroScript>;
const cacheKey = (versionId: string) => `workbook-version:${versionId}`;

export function macroSnapshotKey(workbookVersionId: string, macroId: string): string {
  return `${workbookVersionId}:${macroId}`;
}

/**
 * Resolves executable macro scripts from immutable published workbook versions.
 * This keeps delayed/offline measurement uploads deterministic even when the
 * live macro row has been edited since the workbook was published.
 */
@Injectable()
export class MacroSnapshotRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
  ) {}

  async findScriptsByVersionIds(versionIds: string[]): Promise<Result<Map<string, MacroScript>>> {
    if (versionIds.length === 0) return success(new Map());

    return tryCatch(async () => {
      const bundles = await this.cachePort.tryCacheMany<MacroSnapshotBundle>(
        versionIds.map(cacheKey),
        async (missedKeys) => {
          const missedIds = missedKeys.map((key) => key.slice("workbook-version:".length));
          const rows = await this.database
            .select({
              id: workbookVersions.id,
              cells: workbookVersions.cells,
              entitySnapshots: workbookVersions.entitySnapshots,
            })
            .from(workbookVersions)
            .where(inArray(workbookVersions.id, missedIds));

          return new Map(rows.map((row) => [cacheKey(row.id), this.buildSnapshotBundle(row)]));
        },
      );

      const scripts = new Map<string, MacroScript>();
      for (const versionId of versionIds) {
        const bundle = bundles.get(cacheKey(versionId));
        if (!bundle) continue;
        for (const [macroId, script] of Object.entries(bundle)) {
          scripts.set(macroSnapshotKey(versionId, macroId), script);
        }
      }
      return scripts;
    });
  }

  private buildSnapshotBundle(row: {
    cells: unknown;
    entitySnapshots: unknown;
  }): MacroSnapshotBundle {
    const bundle: MacroSnapshotBundle = {};
    const cells = row.cells as WorkbookCell[];
    const snapshots = row.entitySnapshots as Partial<EntitySnapshots>;
    for (const cell of cells) {
      if (cell.type !== "macro") continue;
      const macroId = cell.payload.macroId;
      const snapshot = snapshots.macros?.[macroId];
      if (!snapshot?.code) continue;
      bundle[macroId] = {
        id: macroId,
        name: cell.payload.name ?? macroId,
        language: cell.payload.language,
        code: snapshot.code,
      };
    }
    return bundle;
  }
}
