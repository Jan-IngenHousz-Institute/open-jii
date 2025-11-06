import { Injectable, Logger } from "@nestjs/common";

import { success, Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

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
        return success(undefined);
      });
    });
  }
}
