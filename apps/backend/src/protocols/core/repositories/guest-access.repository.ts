import { Inject, Injectable } from "@nestjs/common";

import { eq, organizations, protocols } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import type { GuestResourceOwnership } from "../../../authorization/core/ports/guest-resource.port";

@Injectable()
export class GuestProtocolAccessRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}
  async findOwnership(
    id: string,
    executor: DbOrTx = this.database,
  ): Promise<GuestResourceOwnership | null> {
    const rows = await executor
      .select({
        organizationId: protocols.organizationId,
        organizationType: organizations.type,
        visibility: protocols.visibility,
      })
      .from(protocols)
      .leftJoin(organizations, eq(organizations.id, protocols.organizationId))
      .where(eq(protocols.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  }
}
