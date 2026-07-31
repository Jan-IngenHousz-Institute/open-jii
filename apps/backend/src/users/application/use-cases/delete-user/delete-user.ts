import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { success, Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { NewsletterPort } from "../../../../newsletter/core/ports/newsletter.port";
import { NEWSLETTER_PORT } from "../../../../newsletter/core/ports/newsletter.port";
import { UserDto } from "../../../core/models/user.model";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import {
  SOLE_ADMIN_DELETE_MESSAGE,
  UserRepository,
} from "../../../core/repositories/user.repository";

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    @Inject(NEWSLETTER_PORT) private readonly newsletterPort: NewsletterPort,
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

      // Pre-flight blocker: surfaces the hand-off UX before anything is touched.
      // `UserRepository.delete` re-checks this inside its transaction under row
      // locks, which is what actually makes the invariant hold.
      const adminCheckResult = await this.userRepository.isOnlyAdminOfAnyResources(id);

      return adminCheckResult.chain(async (isOnlyAdmin: boolean) => {
        if (isOnlyAdmin) {
          this.logger.warn({
            msg: "Cannot delete user - only admin of shared resources",
            errorCode: ErrorCodes.USER_IS_ONLY_ADMIN,
            operation: "deleteUser",
            userId: id,
          });
          return failure(AppError.forbidden(SOLE_ADMIN_DELETE_MESSAGE));
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

        // Erase the newsletter member only after the local transaction has completed. This is
        // deliberately best-effort: a provider outage must not leave the account half-deleted or
        // prevent the local GDPR deletion from completing.
        try {
          const newsletterDeleteResult = await this.newsletterPort.deleteMember(user.email);

          if (newsletterDeleteResult.isFailure()) {
            this.logger.error({
              msg: "Account deleted, but newsletter member erasure is incomplete",
              errorCode: newsletterDeleteResult.error.code,
              operation: "deleteUserNewsletterErasure",
              userId: id,
              error: newsletterDeleteResult.error.message,
              gdprErasureComplete: false,
              requiresManualIntervention: true,
            });
          }
        } catch (error) {
          this.logger.error({
            msg: "Account deleted, but newsletter member erasure threw unexpectedly",
            errorCode: ErrorCodes.MAILCHIMP_DELETE_FAILED,
            operation: "deleteUserNewsletterErasure",
            userId: id,
            error: error instanceof Error ? error.message : String(error),
            gdprErasureComplete: false,
            requiresManualIntervention: true,
          });
        }

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
