import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";

import { experimentContributorsContract } from "@repo/api/domains/experiment/contributors/experiment-contributors.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListExperimentContributorsUseCase } from "../application/use-cases/list-experiment-contributors/list-experiment-contributors";

@Controller()
export class ExperimentContributorsController {
  private readonly logger = new Logger(ExperimentContributorsController.name);

  constructor(
    private readonly listExperimentContributorsUseCase: ListExperimentContributorsUseCase,
  ) {}

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentContributorsContract.listExperimentContributors)
  listContributors() {
    return implement(experimentContributorsContract.listExperimentContributors).handler(
      async ({ input }) => {
        const result = await this.listExperimentContributorsUseCase.execute(input.id);
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
