import { Inject, Injectable } from "@nestjs/common";

import { and, eq, exists, organizations } from "@repo/database";
import type { AnyColumn, DatabaseInstance, DbOrTx } from "@repo/database";

import type { GuestResourceOwnership } from "../../../authorization/core/ports/guest-resource.port";

@Injectable()
export class GuestOrganizationAccessRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}
  async findOwnership(
    id: string,
    executor: DbOrTx = this.database,
  ): Promise<GuestResourceOwnership | null> {
    const rows = await executor
      .select({
        organizationId: organizations.id,
        organizationType: organizations.type,
        visibility: organizations.visibility,
      })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  }
  static demoCondition(database: DatabaseInstance, organizationId: AnyColumn) {
    return exists(
      database
        .select()
        .from(organizations)
        .where(and(eq(organizations.id, organizationId), eq(organizations.type, "demo"))),
    );
  }
}
