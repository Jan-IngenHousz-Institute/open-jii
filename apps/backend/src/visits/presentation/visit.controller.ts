import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { visitContract } from "@repo/api/domains/visit/visit.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { RecordExperimentVisitUseCase } from "../application/use-cases/record-experiment-visit/record-experiment-visit";

/** Access is checked in the use case before it records the experiment visit. */
@Controller()
export class VisitController {
  private readonly logger = new Logger(VisitController.name);

  constructor(private readonly recordExperimentVisitUseCase: RecordExperimentVisitUseCase) {}

  @Implement(visitContract.recordExperimentVisit)
  recordExperimentVisit(@Session() session: UserSession) {
    return implement(visitContract.recordExperimentVisit).handler(async ({ input }) => {
      const result = await this.recordExperimentVisitUseCase.execute(session.user.id, input.id);
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
