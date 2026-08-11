import { Injectable, Logger } from "@nestjs/common";

import type { OrganizationResourceType } from "@repo/api/domains/organization/organization.schema";

import { AppError, Result, failure, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import type { OrganizationResourceDto } from "../../../core/models/organization.model";
import { canViewOrganization } from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * Rows taken per type before merging. The showcase is a shop window, not a
 * browsable list — each type has its own paginated listing elsewhere.
 */
const PER_TYPE_LIMIT = 25;

/** The subset of every resource DTO the showcase renders from. */
interface ShowcaseRow {
  id: string;
  name: string;
  description?: string | null;
  visibility: "private" | "public";
  updatedAt: Date;
}

/**
 * The organization's resources showcase.
 *
 * Every type's own access-scoped `findAll` does the filtering — this use-case only
 * adds the owning-organization narrowing — so an outsider on a public organization
 * sees exactly its public rows while a member sees everything they may read, with
 * no second definition of "visible" to drift from `can()`.
 */
@Injectable()
export class ListOrganizationResourcesUseCase {
  private readonly logger = new Logger(ListOrganizationResourcesUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly experimentRepository: ExperimentRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly macroRepository: MacroRepository,
    private readonly workbookRepository: WorkbookRepository,
  ) {}

  async execute(
    organizationId: string,
    userId: string,
  ): Promise<Result<{ resources: OrganizationResourceDto[] }>> {
    this.logger.log({
      msg: "Listing an organization's resources",
      operation: "list-organization-resources",
      organizationId,
      userId,
    });

    const accessResult = await this.organizationRepository.findAccess(organizationId, userId);
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization"));
    }
    const access = accessResult.value;
    if (!access || !canViewOrganization(access)) {
      return failure(AppError.notFound(`Organization with ID ${organizationId} not found`));
    }

    const [experiments, protocols, macros, workbooks] = await Promise.all([
      this.experimentRepository.findAll(
        userId,
        undefined,
        undefined,
        undefined,
        PER_TYPE_LIMIT,
        organizationId,
      ),
      this.protocolRepository.findAll(undefined, undefined, userId, PER_TYPE_LIMIT, organizationId),
      this.macroRepository.findAll({ userId, organizationId }, PER_TYPE_LIMIT),
      this.workbookRepository.findAll({ userId, organizationId }, PER_TYPE_LIMIT),
    ]);

    if (isFailure(experiments)) return failure(experiments.error);
    if (isFailure(protocols)) return failure(protocols.error);
    if (isFailure(macros)) return failure(macros.error);
    if (isFailure(workbooks)) return failure(workbooks.error);

    const resources = [
      ...toResources(experiments.value, "experiment"),
      ...toResources(protocols.value, "protocol"),
      ...toResources(macros.value, "macro"),
      ...toResources(workbooks.value, "workbook"),
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return success({ resources });
  }
}

function toResources(
  rows: ShowcaseRow[],
  type: OrganizationResourceType,
): OrganizationResourceDto[] {
  return rows.map((row) => ({
    type,
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    visibility: row.visibility,
    updatedAt: row.updatedAt,
  }));
}
