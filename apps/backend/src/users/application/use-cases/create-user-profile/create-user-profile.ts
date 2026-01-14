import { Injectable, Logger, Inject } from "@nestjs/common";

import { USER_NOT_FOUND, DATABRICKS_REFRESH_FAILED } from "../../../../common/utils/error-codes";
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
      context: CreateUserProfileUseCase.name,
      userId,
    });

    // Check if user exists
    const userResult = await this.userRepository.findOne(userId);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn({
          msg: "Attempt to create profile for non-existent user",
          errorCode: USER_NOT_FOUND,
          operation: "createUserProfile",
          context: CreateUserProfileUseCase.name,
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

        // Check if there are changes that affect metadata-enriched tables
        const hasChangesInMetadata =
          existingProfile &&
          [
            existingProfile.firstName !== data.firstName,
            existingProfile.lastName !== data.lastName,
            data.activated !== undefined && existingProfile.activated !== data.activated,
          ].some(Boolean);

        if (hasChangesInMetadata) {
          // Trigger enriched tables refresh for user metadata changes
          this.logger.log({
            msg: "Triggering enriched tables refresh for profile changes",
            operation: "createUserProfile",
            context: CreateUserProfileUseCase.name,
            userId,
          });
          const refreshResult = await this.databricksPort.triggerEnrichedTablesRefreshJob(
            "user_id",
            userId,
          );

          if (refreshResult.isFailure()) {
            this.logger.warn({
              msg: "Failed to trigger enriched tables refresh",
              errorCode: DATABRICKS_REFRESH_FAILED,
              operation: "createUserProfile",
              context: CreateUserProfileUseCase.name,
              userId,
              error: refreshResult.error.message,
            });
            // Note: We don't fail the entire operation if the refresh trigger fails
            // The profile creation/update was successful and should be returned
          } else {
            this.logger.log({
              msg: "Enriched tables refresh triggered successfully",
              operation: "createUserProfile",
              context: CreateUserProfileUseCase.name,
              userId,
            });
          }
        } else {
          this.logger.debug({
            msg: "No relevant changes detected, skipping refresh",
            operation: "createUserProfile",
            context: CreateUserProfileUseCase.name,
            userId,
          });
        }

        return success(userProfile);
      });
    });
  }
}
