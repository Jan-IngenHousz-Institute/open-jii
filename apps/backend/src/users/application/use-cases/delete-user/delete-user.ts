import { Injectable, Logger, Inject } from "@nestjs/common";

import { success, Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string): Promise<Result<void>> {
    // Check if user exists
    const userResult = await this.userRepository.findOne(id);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn(`Attempt to delete non-existent user with ID ${id}`);
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      // Check if user is the only admin of any experiments
      const adminCheckResult = await this.userRepository.isOnlyAdminOfAnyExperiments(id);

      return adminCheckResult.chain(async (isOnlyAdmin: boolean) => {
        if (isOnlyAdmin) {
          this.logger.warn(
            `Cannot delete user ${id} - user is the only admin of one or more experiments`,
          );
          return failure(
            AppError.forbidden(
              `Cannot delete account - you are the only admin of one or more experiments. Please assign other admins before deleting.`,
            ),
          );
        }

        // Soft delete
        this.logger.log(`Soft-deleting user with ID ${id}`);
        const deleteResult = await this.userRepository.delete(id);

        if (deleteResult.isFailure()) {
          return deleteResult;
        }

        this.logger.log(`Successfully soft-deleted user ${id}`);

        // Trigger enriched tables refresh for user deletion
        this.logger.log(`Triggering enriched tables refresh for user deletion: ${id}`);
        const refreshResult = await this.databricksPort.triggerEnrichedTablesRefreshJob(
          "user_id",
          id,
        );

        if (refreshResult.isFailure()) {
          this.logger.warn(
            `Failed to trigger enriched tables refresh for deleted user ${id}: ${refreshResult.error.message}`,
          );
          // Note: We don't fail the entire operation if the refresh trigger fails
          // The user deletion was successful and should be returned
        } else {
          this.logger.log(`Successfully triggered enriched tables refresh for deleted user ${id}`);
        }

        return success(undefined);
      });
    });
  }
}
