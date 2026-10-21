import { Inject, Injectable } from "@nestjs/common";

import { eq, organizations, macros } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import type { GuestResourceOwnership } from "../../../authorization/core/ports/guest-resource.port";

@Injectable()
export class GuestMacroAccessRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}
  async findOwnership(
    id: string,
    executor: DbOrTx = this.database,
  ): Promise<GuestResourceOwnership | null> {
    const rows = await executor
      .select({
        organizationId: macros.organizationId,
        organizationType: organizations.type,
        visibility: macros.visibility,
      })
      .from(macros)
      .leftJoin(organizations, eq(organizations.id, macros.organizationId))
      .where(eq(macros.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  }
}
