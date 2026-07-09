import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserProfileDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Stamps the user's "What's new" last-seen timestamp to now, clearing the
 * unread indicator across all of their devices. Returns the new timestamp. Guards that the
 * profile row exists first, so a write that would match no rows surfaces as not-found instead
 * of silently succeeding — matching how the other profile-table use cases guard existence.
 */
@Injectable()
export class MarkWhatsNewSeenUseCase {
  private readonly logger = new Logger(MarkWhatsNewSeenUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<Result<Date | null>> {
    this.logger.log({
      msg: "Marking What's new as seen",
      operation: "markWhatsNewSeen",
      userId,
    });

    const profileResult = await this.userRepository.findUserProfile(userId);

    return profileResult.chain(async (profile: UserProfileDto | null) => {
      if (!profile) {
        this.logger.warn({
          msg: "User profile not found",
          errorCode: ErrorCodes.USER_PROFILE_NOT_FOUND,
          operation: "markWhatsNewSeen",
          userId,
        });
        return failure(AppError.notFound(`User profile with ID ${userId} not found`));
      }

      return this.userRepository.markWhatsNewSeen(userId);
    });
  }
}
