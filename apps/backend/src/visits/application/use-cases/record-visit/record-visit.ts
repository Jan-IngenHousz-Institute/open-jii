import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { VisitRepository } from "../../../core/repositories/visit.repository";

@Injectable()
export class RecordVisitUseCase {
  private readonly logger = new Logger(RecordVisitUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly visitRepository: VisitRepository,
  ) {}

  async execute(userId: string, experimentId: string): Promise<Result<void>> {
    // A visit to something the caller cannot open would put a row on their home
    // that the read then has to hide, and it confirms that the id exists.
    const decision = await this.authz.can(userId, {
      resourceType: "experiment",
      resourceId: experimentId,
      action: "read",
    });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot open this resource"),
      );
    }

    const result = await this.visitRepository.recordExperiment(userId, experimentId);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to record visit",
        errorCode: result.error.code,
        operation: "recordVisit",
        userId,
        experimentId,
      });
    }
    return result;
  }
}
