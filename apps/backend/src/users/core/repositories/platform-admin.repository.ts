import { Inject, Injectable } from "@nestjs/common";

import { configuredAdminUserIds } from "@repo/auth/platform-admin";
import { and, eq, ilike, inArray, or, profiles, sql, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { tryCatch } from "../../../common/utils/fp-utils";

@Injectable()
export class PlatformAdminRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  async list() {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: users.id,
          name: sql<string>`coalesce(nullif(trim(concat(${profiles.firstName}, ' ', ${profiles.lastName})), ''), ${users.name})`,
          appointedAt: users.adminGrantedAt,
        })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(or(eq(users.role, "admin"), inArray(users.id, configuredAdminUserIds)))
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
      const name = sql<string>`coalesce(nullif(trim(concat(${profiles.firstName}, ' ', ${profiles.lastName})), ''), ${users.name})`;
      const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      return this.database
        .select({ id: users.id, name })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(and(eq(users.registered, true), or(ilike(name, term), ilike(users.name, term))))
        .orderBy(users.name)
        .limit(20);
    });
  }
}
