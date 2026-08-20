import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { organizationContract } from "@repo/api/domains/organization/organization.contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetOrganizationDeletionBlockersUseCase } from "../application/use-cases/get-organization-deletion-blockers/get-organization-deletion-blockers";
import { GetOrganizationUseCase } from "../application/use-cases/get-organization/get-organization";
import { ListGranteeTeamsUseCase } from "../application/use-cases/list-grantee-teams/list-grantee-teams";
import { ListMyOrganizationsUseCase } from "../application/use-cases/list-my-organizations/list-my-organizations";
import { ListOrganizationMembersUseCase } from "../application/use-cases/list-organization-members/list-organization-members";
import { ListOrganizationResourcesUseCase } from "../application/use-cases/list-organization-resources/list-organization-resources";
import { ListOrganizationTeamGrantsUseCase } from "../application/use-cases/list-organization-team-grants/list-organization-team-grants";
import { ListOrganizationTeamsUseCase } from "../application/use-cases/list-organization-teams/list-organization-teams";
import { ListOrganizationsUseCase } from "../application/use-cases/list-organizations/list-organizations";

@Controller()
export class OrganizationController {
  private readonly logger = new Logger(OrganizationController.name);

  constructor(
    private readonly listOrganizationsUseCase: ListOrganizationsUseCase,
    private readonly listMyOrganizationsUseCase: ListMyOrganizationsUseCase,
    private readonly getOrganizationUseCase: GetOrganizationUseCase,
    private readonly listOrganizationResourcesUseCase: ListOrganizationResourcesUseCase,
    private readonly listOrganizationMembersUseCase: ListOrganizationMembersUseCase,
    private readonly listOrganizationTeamsUseCase: ListOrganizationTeamsUseCase,
    private readonly listOrganizationTeamGrantsUseCase: ListOrganizationTeamGrantsUseCase,
    private readonly listGranteeTeamsUseCase: ListGranteeTeamsUseCase,
    private readonly getOrganizationDeletionBlockersUseCase: GetOrganizationDeletionBlockersUseCase,
  ) {}

  @Implement(organizationContract.listOrganizations)
  listOrganizations(@Session() session: UserSession) {
    return implement(organizationContract.listOrganizations).handler(async ({ input }) => {
      const result = await this.listOrganizationsUseCase.execute(session.user.id, {
        search: input.search,
      });

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.listMyOrganizations)
  listMyOrganizations(@Session() session: UserSession) {
    return implement(organizationContract.listMyOrganizations).handler(async () => {
      const result = await this.listMyOrganizationsUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.getOrganization)
  getOrganization(@Session() session: UserSession) {
    return implement(organizationContract.getOrganization).handler(async ({ input }) => {
      const result = await this.getOrganizationUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.getOrganizationDeletionBlockers)
  getOrganizationDeletionBlockers(@Session() session: UserSession) {
    return implement(organizationContract.getOrganizationDeletionBlockers).handler(
      async ({ input }) => {
        const result = await this.getOrganizationDeletionBlockersUseCase.execute(
          input.id,
          session.user.id,
        );

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(organizationContract.listOrganizationResources)
  listOrganizationResources(@Session() session: UserSession) {
    return implement(organizationContract.listOrganizationResources).handler(async ({ input }) => {
      const result = await this.listOrganizationResourcesUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return {
          resources: formatDatesList(result.value.resources),
          totals: result.value.totals,
        };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.listOrganizationMembers)
  listOrganizationMembers(@Session() session: UserSession) {
    return implement(organizationContract.listOrganizationMembers).handler(async ({ input }) => {
      const result = await this.listOrganizationMembersUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return { members: formatDatesList(result.value.members) };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.listOrganizationTeams)
  listOrganizationTeams(@Session() session: UserSession) {
    return implement(organizationContract.listOrganizationTeams).handler(async ({ input }) => {
      const result = await this.listOrganizationTeamsUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.listOrganizationTeamGrants)
  listOrganizationTeamGrants(@Session() session: UserSession) {
    return implement(organizationContract.listOrganizationTeamGrants).handler(async ({ input }) => {
      const result = await this.listOrganizationTeamGrantsUseCase.execute(
        input.id,
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(organizationContract.listGranteeTeams)
  listGranteeTeams(@Session() session: UserSession) {
    return implement(organizationContract.listGranteeTeams).handler(async ({ input }) => {
      const result = await this.listGranteeTeamsUseCase.execute(
        session.user.id,
        input.resourceType,
        input.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
