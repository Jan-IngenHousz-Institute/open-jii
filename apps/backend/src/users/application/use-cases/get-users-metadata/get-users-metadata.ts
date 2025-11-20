import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { UserProfileMetadata } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

export interface GetUsersMetadataParams {
  userIds: string[];
}

@Injectable()
export class GetUsersMetadataUseCase {
  private readonly logger = new Logger(GetUsersMetadataUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(params: GetUsersMetadataParams): Promise<Result<UserProfileMetadata[]>> {
    this.logger.log(`Fetching user ELT metadata for ${params.userIds.length} user IDs`);

    return await this.userRepository.findUsersByIds(params.userIds);
  }
}
