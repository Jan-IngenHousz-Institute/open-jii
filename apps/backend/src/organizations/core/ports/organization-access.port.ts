import type { Result } from "../../../common/utils/fp-utils";
import type { OrganizationAccessRow } from "../models/organization.model";

export const ORGANIZATION_ACCESS_PORT = Symbol("ORGANIZATION_ACCESS_PORT");

export interface OrganizationAccessPort {
  findAccess(organizationId: string, userId: string): Promise<Result<OrganizationAccessRow | null>>;
}
