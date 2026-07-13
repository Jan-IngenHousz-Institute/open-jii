import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserProfileDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Returns the timestamp the user last opened the "What's new" panel.
 * null = never opened, so the client treats every release note as unread. A missing
 * profile row is an anomaly (not a valid "never seen"), so it surfaces as not-found —
 * matching how the other profile-table use cases guard existence.
 */
@Injectable()
export class GetWhatsNewSeenUseCase {
  private readonly logger = new Logger(GetWhatsNewSeenUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<Result<Date | null>> {
    this.logger.log({
      msg: "Getting What's new last-seen timestamp",
      operation: "getWhatsNewSeen",
      userId,
    });

    const profileResult = await this.userRepository.findUserProfile(userId);

    return profileResult.chain(async (profile: UserProfileDto | null) => {
      if (!profile) {
        this.logger.warn({
          msg: "User profile not found",
          errorCode: ErrorCodes.USER_PROFILE_NOT_FOUND,
          operation: "getWhatsNewSeen",
          userId,
        });
        return failure(AppError.notFound(`User profile with ID ${userId} not found`));
      }

      return this.userRepository.findWhatsNewLastSeen(userId);
    });
  }
}
