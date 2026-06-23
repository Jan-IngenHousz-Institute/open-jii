import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/experiment.schema";

/**
 * Per-experiment anonymization policy: rewrite CONTRIBUTOR struct values to
 * deterministic pseudonyms before result rows leave the API boundary. Every
 * read path routes through `anonymizeRows`, so callers can't leak names.
 */
@Injectable()
export class ContributorAnonymizerService {
  /**
   * Stable pseudonym per (experimentId, userId). 6 hex chars across a typical
   * cohort gives a vanishingly small collision probability. The SQL filter
   * path recomputes this exact form (see `buildFilterCondition`), so the two
   * implementations must stay in lockstep.
   */
  pseudonymFor(experimentId: string, userId: string): string {
    const digest = createHash("sha256")
      .update(`${experimentId}:${userId}`)
      .digest("hex")
      .slice(0, 6)
      .toUpperCase();
    return `Contributor-${digest}`;
  }

  /**
   * Rewrite every CONTRIBUTOR cell when anonymization is enabled. Pseudonymises
   * `id` and `name` (so the FE can't recover the real id via name) and clears
   * `avatar`.
   */
  anonymizeRows(
    rows: Record<string, string | null>[],
    columns: { name: string; type_text: string }[],
    experiment: { id: string; anonymizeContributors: boolean },
  ): Record<string, string | null>[] {
    if (!experiment.anonymizeContributors) {
      return rows;
    }
    const contributorColumns = columns.filter(
      (c) => c.type_text === WellKnownColumnTypes.CONTRIBUTOR,
    );
    if (contributorColumns.length === 0) {
      return rows;
    }

    return rows.map((row) => {
      const next = { ...row };
      for (const col of contributorColumns) {
        const v = row[col.name];
        if (v == null) {
          continue;
        }
        const parsed = JSON.parse(v) as { id?: string };
        const pseudo = this.pseudonymFor(experiment.id, parsed.id ?? "");
        next[col.name] = JSON.stringify({ id: pseudo, name: pseudo, avatar: null });
      }
      return next;
    });
  }

  /**
   * Pseudonymise contributor structs surfaced by the distinct-values filter
   * picker, at full parity with `anonymizeRows` (id + name + avatar). The
   * picker sends the struct's `id` back as the filter match value; the data
   * read recomputes the same pseudonym in SQL (see `buildFilterCondition`'s
   * `contributorPseudonymSalt` path) to match raw rows, so the real id never
   * reaches the client.
   */
  anonymizeDistinctValues(
    values: (string | number)[],
    columnType: string | undefined,
    experiment: { id: string; anonymizeContributors: boolean },
  ): (string | number)[] {
    if (!experiment.anonymizeContributors || columnType !== WellKnownColumnTypes.CONTRIBUTOR) {
      return values;
    }

    return values.map((v) => {
      if (typeof v !== "string") {
        return v;
      }
      const realId = (JSON.parse(v) as { id?: string }).id ?? "";
      const pseudo = this.pseudonymFor(experiment.id, realId);
      return JSON.stringify({ id: pseudo, name: pseudo, avatar: null });
    });
  }
}
