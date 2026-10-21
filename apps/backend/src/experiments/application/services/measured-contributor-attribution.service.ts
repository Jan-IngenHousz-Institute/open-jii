import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  WellKnownColumnTypes,
  zExperimentDataContributor,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { USER_PRESENCE_PORT } from "../../../users/core/ports/user-presence.port";
import type { UserPresencePort } from "../../../users/core/ports/user-presence.port";

@Injectable()
export class MeasuredContributorAttributionService {
  constructor(@Inject(USER_PRESENCE_PORT) private readonly users: UserPresencePort) {}

  async enrichRows(
    rows: Record<string, string | null>[],
    columns: { name: string; type_text: string }[],
  ): Promise<Record<string, string | null>[]> {
    const contributors = columns.filter(
      ({ type_text }) => type_text === WellKnownColumnTypes.CONTRIBUTOR,
    );
    if (contributors.length === 0) return rows;
    const marker = columns.some(
      ({ name, type_text }) => name === "is_guest" && type_text.toUpperCase() === "BOOLEAN",
    );
    const parsed = rows.map((row) => ({
      row,
      guest: marker && row.is_guest === "true",
      cells: contributors.map(({ name }) => {
        try {
          return { name, value: zExperimentDataContributor.parse(JSON.parse(row[name] ?? "null")) };
        } catch {
          return { name, value: null };
        }
      }),
    }));
    const ids = [
      ...new Set(
        parsed
          .filter(({ guest }) => guest)
          .flatMap(({ cells }) =>
            cells.flatMap(({ value }) =>
              value && z.string().uuid().safeParse(value.id).success
                ? [value.id.toLowerCase()]
                : [],
            ),
          ),
      ),
    ];
    const existing = new Set(ids.length ? await this.users.findExistingIds(ids) : []);
    return parsed.map(({ row, guest, cells }) => {
      const next = { ...row };
      for (const { name, value } of cells) {
        if (!value) continue;
        const former = guest && !existing.has(value.id.toLowerCase());
        next[name] = JSON.stringify({
          ...value,
          name: former ? "" : value.name,
          avatar: guest ? null : value.avatar,
          isGuest: guest,
          isFormerGuest: former,
        });
      }
      return next;
    });
  }
}
