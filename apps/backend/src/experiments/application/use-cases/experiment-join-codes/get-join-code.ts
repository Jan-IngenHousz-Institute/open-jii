import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinCodeDto } from "../../../core/models/experiment-join-code.model";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";

@Injectable()
export class GetJoinCodeUseCase {
  private readonly logger = new Logger(GetJoinCodeUseCase.name);

  constructor(private readonly joinCodeRepository: ExperimentJoinCodeRepository) {}

  /**
   * The live code, expired or not: the organizer card shows an expired code with a
   * banner rather than pretending none exists.
   */
  execute(experimentId: string): Promise<Result<ExperimentJoinCodeDto | null>> {
    this.logger.log({
      msg: "Reading the active join code",
      operation: "get-join-code",
      experimentId,
    });

    return this.joinCodeRepository.findActive(experimentId);
  }
}
