import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { visitContract } from "@repo/api/domains/visit/visit.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { RecordVisitUseCase } from "../application/use-cases/record-visit/record-visit";

/** The resource type arrives in the body, so access is checked in the use case. */
@Controller()
export class VisitController {
  private readonly logger = new Logger(VisitController.name);

  constructor(private readonly recordVisitUseCase: RecordVisitUseCase) {}

  @Implement(visitContract.recordVisit)
  recordVisit(@Session() session: UserSession) {
    return implement(visitContract.recordVisit).handler(async ({ input }) => {
      const result = await this.recordVisitUseCase.execute(
        session.user.id,
        input.resourceType,
        input.resourceId,
      );
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
