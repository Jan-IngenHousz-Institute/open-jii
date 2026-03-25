import { Injectable, Logger } from "@nestjs/common";

import { success, Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

interface DeletionCheckResult {
  canDelete: boolean;
  blockingExperiments: { id: string; name: string; status: string }[];
}

@Injectable()
export class GetDeletionCheckUseCase {
  private readonly logger = new Logger(GetDeletionCheckUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<DeletionCheckResult>> {
    const userResult = await this.userRepository.findOne(id);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      const blockingResult = await this.userRepository.getExperimentsWhereOnlyAdmin(id);

      return blockingResult.chain(
        (blockingExperiments: { id: string; name: string; status: string }[]) => {
          this.logger.log({
            msg: "Deletion check completed",
            operation: "getDeletionCheck",
            userId: id,
            canDelete: blockingExperiments.length === 0,
            blockingCount: blockingExperiments.length,
          });

          return success({
            canDelete: blockingExperiments.length === 0,
            blockingExperiments,
          });
        },
      );
    });
  }
}
