import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { IotDeviceGroupRepository } from "../../../../iot/core/repositories/iot-device-group.repository";
import { IotDeviceRepository } from "../../../../iot/core/repositories/iot-device.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import {
  SharingRepository,
  collaboratorCountKey,
} from "../../../../sharing/core/repositories/sharing.repository";
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
 * A device's display name. `name` is nullable and `thing_name` is not — the same
 * fallback `RESOURCE_NAME_SQL` applies for the team-grants list.
 */
function deviceName(device: { name: string | null; thingName: string }): string {
  return device.name ?? device.thingName;
}

/**
 * The organization's resources showcase. Each type's own access-scoped `findAll` does
 * the filtering, so there is no second definition of "visible" to drift from `can()`.
 *
 * Uncapped on purpose — this is the only view of everything an organization owns, so
 * "view all" has to mean all of it. `totals` is still counted separately because a
 * group header needs the honest number, and that second computation is the seam a row
 * filter added later would reopen.
 *
 * Collaborator counts are one grouped read over every id at once, joined onto the rows
 * here — per-resource would scale with an uncapped view.
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
    private readonly iotDeviceRepository: IotDeviceRepository,
    private readonly iotDeviceGroupRepository: IotDeviceGroupRepository,
    private readonly sharingRepository: SharingRepository,
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

    const [experiments, protocols, macros, workbooks, devices, deviceGroups, totals] =
      await Promise.all([
        // Archived stay in: every other count of what an organization owns includes them,
        // so dropping them here would let a group header promise a row the list cannot show.
        this.experimentRepository.findAll(userId, undefined, undefined, undefined, undefined, {
          organizationId,
          includeArchived: true,
        }),
        this.protocolRepository.findAll(undefined, undefined, userId, undefined, organizationId),
        this.macroRepository.findAll({ userId, organizationId }),
        this.workbookRepository.findAll({ userId, organizationId }),
        this.iotDeviceRepository.listAccessible(userId, { organizationId }),
        this.iotDeviceGroupRepository.listAccessible(userId, { organizationId }),
        this.organizationRepository.countAccessibleResources(organizationId, userId),
      ]);

    if (isFailure(experiments)) return failure(experiments.error);
    if (isFailure(protocols)) return failure(protocols.error);
    if (isFailure(macros)) return failure(macros.error);
    if (isFailure(workbooks)) return failure(workbooks.error);
    if (isFailure(devices)) return failure(devices.error);
    if (isFailure(deviceGroups)) return failure(deviceGroups.error);
    if (totals.isFailure()) {
      return failure(AppError.internal("Failed to count an organization's resources"));
    }

    const collaborators = await this.sharingRepository.countCollaborators(organizationId, [
      ...experiments.value.map((row) => ({
        resourceType: "experiment" as const,
        resourceId: row.id,
      })),
      ...protocols.value.map((row) => ({ resourceType: "protocol" as const, resourceId: row.id })),
      ...macros.value.map((row) => ({ resourceType: "macro" as const, resourceId: row.id })),
      ...workbooks.value.map((row) => ({ resourceType: "workbook" as const, resourceId: row.id })),
      ...devices.value.map((row) => ({ resourceType: "device" as const, resourceId: row.id })),
      ...deviceGroups.value.map((row) => ({
        resourceType: "device_group" as const,
        resourceId: row.id,
      })),
    ]);
    if (collaborators.isFailure()) {
      return failure(AppError.internal("Failed to count an organization's collaborators"));
    }

    // Zero rather than a hole: every id asked about comes back, so a miss means the
    // resource was deleted between the two reads.
    const countFor = (type: OrganizationResourceDto["type"], id: string) =>
      collaborators.value.get(collaboratorCountKey(type, id)) ?? 0;

    const resources = [
      ...experiments.value.map((row) => ({
        ...base(row, countFor("experiment", row.id)),
        type: "experiment" as const,
        status: row.status,
      })),
      ...protocols.value.map((row) => ({
        ...base(row, countFor("protocol", row.id)),
        type: "protocol" as const,
        family: row.family,
      })),
      ...macros.value.map((row) => ({
        ...base(row, countFor("macro", row.id)),
        type: "macro" as const,
        language: row.language,
      })),
      ...workbooks.value.map((row) => ({
        ...base(row, countFor("workbook", row.id)),
        type: "workbook" as const,
      })),
      ...devices.value.map((row) => ({
        ...base({ ...row, name: deviceName(row), description: null }, countFor("device", row.id)),
        type: "device" as const,
        deviceType: row.deviceType,
      })),
      ...deviceGroups.value.map((row) => ({
        ...base(row, countFor("device_group", row.id)),
        type: "device_group" as const,
        // Already on the row the list read: the group projection carries its roster
        // size, so showing it costs no second query.
        memberCount: row.memberCount,
      })),
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return success({ resources, totals: totals.value });
  }
}

/** The columns every showcased type contributes, whatever its own meta is. */
function base(
  row: ShowcaseRow,
  collaboratorCount: number,
): Omit<ShowcaseRow, "description"> & { description: string | null; collaboratorCount: number } {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    visibility: row.visibility,
    updatedAt: row.updatedAt,
    collaboratorCount,
  };
}
