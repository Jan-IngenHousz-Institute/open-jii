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

      // Update the user
      const updatedUser: UpdateUserDto = {
        name: `${data.firstName} ${data.lastName}`,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        registered: true,
      };
      const updatedResult = await this.userRepository.update(userId, updatedUser);
      if (updatedResult.isFailure()) {
        return failure(AppError.notFound(`Cannot update user with ID ${userId}`));
      }

      // Check if a user profile already exists for the user
      const userProfileResult = await this.userRepository.findOneUserProfile(user.id);
      return userProfileResult.chain(async (userProfile: UserProfileDto | null) => {
        if (!userProfile) {
          // Create a new user profile
          const newUserProfileResult = await this.userRepository.createUserProfile(userId, data);
          return newUserProfileResult.chain((userProfile: UserProfileDto | null) => {
            return success(userProfile);
          });
        }
        return success(userProfile);
      });
    });
  }
}
