import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { failure, AppError, success } from "../../../../common/utils/fp-utils";
import {
  UserDto,
  CreateUserProfileDto,
  UserProfileDto,
  UpdateUserDto,
} from "../../../core/models/user.model";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class CreateUserProfileUseCase {
  private readonly logger = new Logger(CreateUserProfileUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(data: CreateUserProfileDto, userId: string) {
    this.logger.log({
      msg: "Creating user profile",
      operation: "createUserProfile",
      userId,
    });

    // Check if user exists
    const userResult = await this.userRepository.findOne(userId);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn({
          msg: "Attempt to create profile for non-existent user",
          errorCode: ErrorCodes.USER_NOT_FOUND,
          operation: "createUserProfile",
          userId,
        });
        return failure(AppError.notFound(`User with ID ${userId} not found`));
      }

      // Get existing profile to compare changes
      const existingProfileResult = await this.userRepository.findUserProfile(userId);
      if (existingProfileResult.isFailure()) {
        return existingProfileResult;
      }

      const existingProfile = existingProfileResult.value;

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

        // With centrum consolidation, materialized views auto-refresh when user data changes

        return success(userProfile);
      });
    });
  }
}
