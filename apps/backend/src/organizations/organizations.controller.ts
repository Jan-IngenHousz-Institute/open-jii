import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  OrganizationJoinRequestDto,
  OrganizationSummary,
} from "@repo/api/schemas/organization.schema";

import { handleFailure } from "../common/utils/fp-utils";
import { JoinRequestRow, OrganizationSummaryRow } from "./organizations.repository";
import {
  CancelOrganizationJoinRequestUseCase,
  DecideOrganizationJoinRequestUseCase,
  GetOrganizationAccessUseCase,
  GetOrganizationResourcesUseCase,
  GetOrganizationUseCase,
  ListOrganizationJoinRequestsUseCase,
  ListPublicOrganizationsUseCase,
  RequestOrganizationJoinUseCase,
} from "./organizations.use-cases";

function toSummary(row: OrganizationSummaryRow): OrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo,
    type: (row.type as OrganizationSummary["type"]) ?? null,
    description: row.description,
    website: row.website,
    location: row.location,
    visibility: row.visibility,
    memberCount: row.memberCount,
    membershipStatus: row.membershipStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRequest(row: JoinRequestRow): OrganizationJoinRequestDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    user: row.user,
    message: row.message,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Controller()
export class OrganizationsController {
  private readonly logger = new Logger(OrganizationsController.name);

  constructor(
    private readonly listPublic: ListPublicOrganizationsUseCase,
    private readonly getOrg: GetOrganizationUseCase,
    private readonly getResources: GetOrganizationResourcesUseCase,
    private readonly requestJoin: RequestOrganizationJoinUseCase,
    private readonly listRequests: ListOrganizationJoinRequestsUseCase,
    private readonly decideRequest: DecideOrganizationJoinRequestUseCase,
    private readonly cancelRequest: CancelOrganizationJoinRequestUseCase,
    private readonly getAccess: GetOrganizationAccessUseCase,
  ) {}

  @TsRestHandler(contract.organizations.listPublicOrganizations)
  list(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.listPublicOrganizations, async ({ query }) => {
      const result = await this.listPublic.execute(session.user.id, query);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: result.value.map(toSummary) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.getOrganization)
  get(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.getOrganization, async ({ params }) => {
      const result = await this.getOrg.execute(session.user.id, params.id);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: toSummary(result.value) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.getOrganizationResources)
  resources() {
    return tsRestHandler(contract.organizations.getOrganizationResources, async ({ params }) => {
      const result = await this.getResources.execute(params.id);
      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: {
            experiments: result.value.experiments.map(toResourceItem),
            macros: result.value.macros.map(toResourceItem),
            protocols: result.value.protocols.map(toResourceItem),
            workbooks: result.value.workbooks.map(toResourceItem),
            devices: result.value.devices.map(toResourceItem),
          },
        };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.getOrganizationAccess)
  access(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.getOrganizationAccess, async ({ params }) => {
      const result = await this.getAccess.execute(session.user.id, params.id);
      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: {
            organization: toSummary(result.value.organization),
            members: result.value.members,
            teams: result.value.teams,
          },
        };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.requestToJoin)
  request(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.requestToJoin, async ({ params, body }) => {
      const result = await this.requestJoin.execute(session.user.id, params.id, body.message);
      if (result.isSuccess()) {
        const status = result.value.created ? StatusCodes.CREATED : StatusCodes.OK;
        return { status: status as 201, body: toRequest(result.value.joinRequest) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.listJoinRequests)
  requests(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.listJoinRequests, async ({ params }) => {
      const result = await this.listRequests.execute(session.user.id, params.id);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: result.value.map(toRequest) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.approveJoinRequest)
  approve(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.approveJoinRequest, async ({ params }) => {
      const result = await this.decideRequest.execute(
        session.user.id,
        params.id,
        params.requestId,
        "approved",
      );
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: toRequest(result.value) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.rejectJoinRequest)
  reject(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.rejectJoinRequest, async ({ params }) => {
      const result = await this.decideRequest.execute(
        session.user.id,
        params.id,
        params.requestId,
        "rejected",
      );
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: toRequest(result.value) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.organizations.cancelJoinRequest)
  cancel(@Session() session: UserSession) {
    return tsRestHandler(contract.organizations.cancelJoinRequest, async ({ params }) => {
      const result = await this.cancelRequest.execute(session.user.id, params.id, params.requestId);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: toRequest(result.value) };
      }
      return handleFailure(result, this.logger);
    });
  }
}

function toResourceItem(item: {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date | null;
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
  };
}
