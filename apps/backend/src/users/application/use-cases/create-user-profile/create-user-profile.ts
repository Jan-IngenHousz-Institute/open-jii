import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto, UserProfileDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class CreateUserProfileUseCase {
  private readonly logger = new Logger(CreateUserProfileUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(data: UserProfileDto, id: string): Promise<Result<UserDto>> {
    this.logger.log(`Creates user profile for user with ID ${id}`);

    // Check if user exists
    const userResult = await this.userRepository.findOne(id);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn(`Attempt to create profile for non-existent user with ID ${id}`);
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      this.logger.debug(`Setting user "${user.email}" (ID: ${id}) to registered`);
      // Update the user to set registered status
      const updatedResult = await this.userRepository.updateRegisteredStatus(id);
      return updatedResult.chain((updatedUsers: UserDto[]) => {
        if (updatedUsers.length === 0) {
          this.logger.error(`Failed to create profile for user ${id}`);
          return failure(AppError.internal(`Failed to create profile for user ${id}`));
        }

        const updatedUser = updatedUsers[0];
        this.logger.log(`Successfully create profile for user (ID: ${id})`);
        return success(updatedUser);
      });
    });
  }
}
