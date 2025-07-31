import { Injectable, Logger } from "@nestjs/common";

import { failure, AppError, success } from "../../../../common/utils/fp-utils";
import {
  UserDto,
  CreateUserProfileDto,
  UserProfileDto,
  UpdateUserDto,
} from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class CreateUserProfileUseCase {
  private readonly logger = new Logger(CreateUserProfileUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(data: CreateUserProfileDto, userId: string) {
    this.logger.log(`Creates user profile for user with ID ${userId}`);

    // Check if user exists
    const userResult = await this.userRepository.findOne(userId);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn(`Attempt to create profile for non-existent user with ID ${userId}`);
        return failure(AppError.notFound(`User with ID ${userId} not found`));
      }

      // Create or update the profile
      const userProfileResult = await this.userRepository.createOrUpdateUserProfile(userId, data);
      return userProfileResult.chain(async (userProfile: UserProfileDto) => {
        // Update the user with the registered flag
        const updatedUser: UpdateUserDto = {
          registered: true,
        };
        const updatedResult = await this.userRepository.update(userId, updatedUser);
        if (updatedResult.isFailure()) {
          return failure(AppError.notFound(`Cannot update user with ID ${userId}`));
        }

        return success(userProfile);
      });
    });
  }
}
