import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

/**
 * Per-experiment anonymization policy: rewrite CONTRIBUTOR struct values to
 * deterministic pseudonyms before result rows leave the API boundary. Every
 * read path routes through `anonymizeRows`, so callers can't leak names.
 */
@Injectable()
export class ContributorAnonymizerService {
  /**
   * Stable pseudonym per (experimentId, userId). 6 hex chars across a typical
   * cohort gives a vanishingly small collision probability.
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
   * picker. Mirrors `anonymizeRows` for `name`/`avatar` but KEEPS the real
   * `id`: the categorical filter sends the struct's `id` back as the match
   * value and the data query filters raw (un-anonymised) rows by it, so a
   * pseudonymised id here would filter to nothing. The id is never rendered
   * (the picker shows the name), so the pseudonym still hides who contributed.
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
      return JSON.stringify({ id: realId, name: pseudo, avatar: null });
    });
  }
}
