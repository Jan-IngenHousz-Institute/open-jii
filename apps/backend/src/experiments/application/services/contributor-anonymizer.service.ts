import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

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
   * `avatar`. The author of each annotation in an ANNOTATIONS cell gets the same
   * pseudonym.
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
    const annotationColumns = columns.filter(
      (c) => c.type_text === WellKnownColumnTypes.ANNOTATIONS,
    );
    if (contributorColumns.length === 0 && annotationColumns.length === 0) {
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
      for (const col of annotationColumns) {
        const v = row[col.name];
        if (v == null) {
          continue;
        }
        next[col.name] = this.anonymizeAuthors(v, experiment.id);
      }
      return next;
    });
  }

  /** The platform's annotations name their author; the phone's name none and stay as they are. */
  private anonymizeAuthors(cell: string, experimentId: string): string {
    const annotations: unknown = JSON.parse(cell);
    if (!Array.isArray(annotations)) {
      return cell;
    }

    return JSON.stringify(
      annotations.map((annotation: unknown) => {
        if (!this.hasAuthor(annotation)) {
          return annotation;
        }
        const pseudo = this.pseudonymFor(experimentId, annotation.createdBy);
        return { ...annotation, createdBy: pseudo, createdByName: pseudo };
      }),
    );
  }

  private hasAuthor(annotation: unknown): annotation is { createdBy: string } {
    return (
      typeof annotation === "object" &&
      annotation !== null &&
      "createdBy" in annotation &&
      typeof annotation.createdBy === "string"
    );
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
    if (!experiment.anonymizeContributors) {
      return values;
    }
    // A distinct annotations cell names its platform authors as a row's cell does.
    if (columnType === WellKnownColumnTypes.ANNOTATIONS) {
      return values.map((v) =>
        typeof v === "string" ? this.anonymizeAuthors(v, experiment.id) : v,
      );
    }
    if (columnType !== WellKnownColumnTypes.CONTRIBUTOR) {
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
