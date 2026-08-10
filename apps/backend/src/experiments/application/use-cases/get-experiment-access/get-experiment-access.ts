import { Injectable, Logger } from "@nestjs/common";

import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { resolveResourceCapabilities } from "../../../../authorization/resource-capabilities";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface ExperimentAccessDto {
  experiment: ExperimentDto;
  hasAccess: boolean;
  isAdmin: boolean;
  capabilities: ResourceCapabilities;
}

@Injectable()
export class GetExperimentAccessUseCase {
  private readonly logger = new Logger(GetExperimentAccessUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(id: string, userId: string): Promise<Result<ExperimentAccessDto>> {
    this.logger.log({
      msg: "Getting experiment access",
      operation: "get_access",
      experimentId: id,
      userId,
    });

    // Read access is enforced by the `@CanAccess({ resource: "experiment",
    // action: "read" })` route guard, so reaching here means the caller can read
    // the experiment. `checkAccess` is still used to derive `isAdmin`
    // (= can(manage)); `hasAccess` reflects effective read access.
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            operation: "get_access",
            experimentId: id,
          });
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        // The full capability set, so the page can gate on `canShare` —
        // the capability that owns access tiers now that the contributor roster
        // carries none. `isAdmin` (= can(manage)) stays for its existing
        // call sites.
        const capabilities = await resolveResourceCapabilities(
          this.authz,
          userId,
          "experiment",
          id,
        );

        this.logger.debug({
          msg: "Retrieved experiment access",
          operation: "get_access",
          experimentId: id,
          isAdmin,
        });

        const accessInfo: ExperimentAccessDto = {
          experiment,
          hasAccess: true,
          isAdmin,
          capabilities,
        };

        return success(accessInfo);
      },
    );
  }
}
