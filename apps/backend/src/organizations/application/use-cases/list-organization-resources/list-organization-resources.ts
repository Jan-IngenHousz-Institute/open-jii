import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import type {
  OrganizationResourceDto,
  OrganizationResourceTotalsDto,
} from "../../../core/models/organization.model";
import { canViewOrganization } from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/** The subset of every resource DTO the showcase renders from. */
interface ShowcaseRow {
  id: string;
  name: string;
  description?: string | null;
  visibility: "private" | "public";
  updatedAt: Date;
}

/**
 * The organization's resources showcase. Each type's own access-scoped `findAll` does
 * the filtering, so there is no second definition of "visible" to drift from `can()`.
 *
 * Uncapped on purpose — this is the only view of everything an organization owns, so
 * "view all" has to mean all of it. `totals` is still counted separately because a
 * group header needs the honest number, and that second computation is the seam a row
 * filter added later would reopen.
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
  ): Promise<
    Result<{ resources: OrganizationResourceDto[]; totals: OrganizationResourceTotalsDto }>
  > {
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

    const [experiments, protocols, macros, workbooks, totals] = await Promise.all([
      // Archived stay in: every other count of what an organization owns includes them,
      // so dropping them here would let a group header promise a row the list cannot show.
      this.experimentRepository.findAll(userId, undefined, undefined, undefined, undefined, {
        organizationId,
        includeArchived: true,
      }),
      this.protocolRepository.findAll(undefined, undefined, userId, undefined, organizationId),
      this.macroRepository.findAll({ userId, organizationId }),
      this.workbookRepository.findAll({ userId, organizationId }),
      this.organizationRepository.countAccessibleResources(organizationId, userId),
    ]);

    if (isFailure(experiments)) return failure(experiments.error);
    if (isFailure(protocols)) return failure(protocols.error);
    if (isFailure(macros)) return failure(macros.error);
    if (isFailure(workbooks)) return failure(workbooks.error);
    if (totals.isFailure()) {
      return failure(AppError.internal("Failed to count an organization's resources"));
    }

    const resources = [
      ...experiments.value.map((row) => ({
        ...base(row),
        type: "experiment" as const,
        status: row.status,
      })),
      ...protocols.value.map((row) => ({
        ...base(row),
        type: "protocol" as const,
        family: row.family,
      })),
      ...macros.value.map((row) => ({
        ...base(row),
        type: "macro" as const,
        language: row.language,
      })),
      ...workbooks.value.map((row) => ({ ...base(row), type: "workbook" as const })),
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return success({ resources, totals: totals.value });
  }
}

/** The columns every showcased type contributes, whatever its own meta is. */
function base(row: ShowcaseRow): Omit<ShowcaseRow, "description"> & { description: string | null } {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    visibility: row.visibility,
    updatedAt: row.updatedAt,
  };
}
