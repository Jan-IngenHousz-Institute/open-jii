import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
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
    this.logger.log({
      msg: "Starting user deletion",
      operation: "deleteUser",
      userId: id,
    });

    // Check if user exists
    const userResult = await this.userRepository.findOne(id);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn({
          msg: "Attempt to delete non-existent user",
          errorCode: ErrorCodes.USER_NOT_FOUND,
          operation: "deleteUser",
          userId: id,
        });
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      // Check if user is the only admin of any experiments
      const adminCheckResult = await this.userRepository.isOnlyAdminOfAnyExperiments(id);

      return adminCheckResult.chain(async (isOnlyAdmin: boolean) => {
        if (isOnlyAdmin) {
          this.logger.warn({
            msg: "Cannot delete user - only admin of experiments",
            errorCode: ErrorCodes.USER_IS_ONLY_ADMIN,
            operation: "deleteUser",
            userId: id,
          });
          return failure(
            AppError.forbidden(
              `Cannot delete account - you are the only admin of one or more experiments. Please assign other admins before deleting.`,
            ),
          );
        }

        // Soft delete
        this.logger.log({
          msg: "Soft-deleting user",
          operation: "deleteUser",
          userId: id,
        });
        const deleteResult = await this.userRepository.delete(id);

        if (deleteResult.isFailure()) {
          return deleteResult;
        }

        this.logger.log({
          msg: "User soft-deleted successfully",
          operation: "deleteUser",
          userId: id,
          status: "success",
        });

        // Note: With centrum consolidation, materialized views auto-refresh when user data changes
        // No manual refresh triggers needed

        this.logger.log({
          msg: "User deletion completed",
          operation: "deleteUser",
          userId: id,
          status: "success",
        });

        return success(undefined);
      });
    });
  }
}
