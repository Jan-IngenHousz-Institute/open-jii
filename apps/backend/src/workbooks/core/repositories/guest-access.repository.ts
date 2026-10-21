import { Inject, Injectable } from "@nestjs/common";

import { eq, organizations, workbooks } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import type { GuestResourceOwnership } from "../../../authorization/core/ports/guest-resource.port";

@Injectable()
export class GuestWorkbookAccessRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}
  async findOwnership(
    id: string,
    executor: DbOrTx = this.database,
  ): Promise<GuestResourceOwnership | null> {
    const rows = await executor
      .select({
        organizationId: workbooks.organizationId,
        organizationType: organizations.type,
        visibility: workbooks.visibility,
      })
      .from(workbooks)
      .leftJoin(organizations, eq(organizations.id, workbooks.organizationId))
      .where(eq(workbooks.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  }
}
