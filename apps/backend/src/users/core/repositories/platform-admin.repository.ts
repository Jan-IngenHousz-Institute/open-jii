import { Inject, Injectable } from "@nestjs/common";

import { and, eq, inArray, isNull, listPlatformRoleHolders, profiles, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { tryCatch } from "../../../common/utils/fp-utils";

@Injectable()
export class PlatformAdminRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  async list() {
    return tryCatch(async () => {
      const holders = (await listPlatformRoleHolders(this.database)).filter((holder) =>
        holder.roles.includes("platform_admin"),
      );
      if (holders.length === 0) return [];
      const rows = await this.database
        .select({
          id: users.id,
          accountName: users.name,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
        })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(
            inArray(
              users.id,
              holders.map((holder) => holder.userId),
            ),
            isNull(profiles.deletedAt),
          ),
        );
      return rows
        .map((row) => ({
          id: row.id,
          name:
            row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : row.accountName,
          grantedAt:
            holders
              .find((holder) => holder.userId === row.id)
              ?.grantedAt.platform_admin?.toISOString() ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    });
  }
}
