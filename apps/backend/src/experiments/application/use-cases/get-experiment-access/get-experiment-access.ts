import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface ExperimentAccessDto {
  experiment: ExperimentDto;
  hasAccess: boolean;
  isAdmin: boolean;
}

@Injectable()
export class GetExperimentAccessUseCase {
  private readonly logger = new Logger(GetExperimentAccessUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

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
      ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            operation: "get_access",
            experimentId: id,
          });
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

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
        };

        return success(accessInfo);
      },
    );
  }
}
