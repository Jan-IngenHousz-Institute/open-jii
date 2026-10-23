import { Inject, Injectable } from "@nestjs/common";

import { configuredAdminUserIds } from "@repo/auth/platform-admin";
import { and, eq, ilike, inArray, or, profiles, isNull, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike } from "../../../common/utils/fts";
import { userDisplayNameSql } from "./user-display-name";

@Injectable()
export class PlatformAdminRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  async list() {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: users.id,
          name: userDisplayNameSql(),
          appointedAt: users.adminGrantedAt,
        })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(
            isNull(profiles.deletedAt),
            or(eq(users.role, "admin"), inArray(users.id, configuredAdminUserIds)),
          ),
        )
        .orderBy(users.name);
      return rows.map((row) => ({
        ...row,
        configured: configuredAdminUserIds.includes(row.id),
        appointedAt: row.appointedAt?.toISOString() ?? null,
      }));
    });
  }

  async search(search: string) {
    return tryCatch(async () => {
      const name = userDisplayNameSql();
      const term = `%${escapeLike(search)}%`;
      return this.database
        .select({ id: users.id, name })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(
            eq(users.registered, true),
            isNull(profiles.deletedAt),
            or(ilike(name, term), ilike(users.name, term)),
          ),
        )
        .orderBy(users.name)
        .limit(20);
    });
  }
}
