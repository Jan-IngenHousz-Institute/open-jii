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
    this.logger.log({
      msg: "Fetching users metadata",
      operation: "getUsersMetadata",
      context: GetUsersMetadataUseCase.name,
      userCount: params.userIds.length,
    });

    return await this.userRepository.findUsersByIds(params.userIds);
  }
}
