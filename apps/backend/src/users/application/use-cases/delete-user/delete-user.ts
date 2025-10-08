import { Injectable, Logger } from "@nestjs/common";

import { seedSystemOwner } from "@repo/database";

import { success, Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<void>> {
    this.logger.log(`Deleting user with ID ${id}`);

    // Check if user exists
    const userResult = await this.userRepository.findOne(id);

    return userResult.chain(async (user) => {
      if (!user) {
        this.logger.warn(`Attempt to delete non-existent user with ID ${id}`);
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      // Ensure system owner exists before deleting
      this.logger.log(`Ensuring system owner exists before deleting user ${id}`);

      try {
        await seedSystemOwner();
        this.logger.log("System owner verified/created");
      } catch (err) {
        this.logger.error("Failed to seed system owner", err as Error);
        return failure(
          AppError.internal(
            "Failed to ensure system owner exists",
            "SYSTEM_OWNER_SEED_FAILED",
            err,
          ),
        );
      }

      // Perform the soft delete
      this.logger.log(`Soft-deleting user with ID ${id}`);
      const deleteResult = await this.userRepository.delete(id);

      return deleteResult.chain(() => {
        this.logger.log(`Successfully soft-deleted user ${id}`);
        return success(undefined);
      });
    });
  }
}
