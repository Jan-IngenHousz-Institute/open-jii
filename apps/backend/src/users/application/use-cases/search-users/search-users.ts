import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result } from "../../../../common/utils/fp-utils";
import { UserProfileDto, SearchUsersParams } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class SearchUsersUseCase {
  private readonly logger = new Logger(SearchUsersUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(params: SearchUsersParams): Promise<Result<UserProfileDto[]>> {
    this.logger.log(
      `Searching users with query: "${params.query ?? ""}", limit: ${params.limit ?? 50}, offset: ${params.offset ?? 0}`,
    );

    const result = await this.userRepository.search(params);

    result.fold(
      (users: UserProfileDto[]) => {
        this.logger.debug(`Found ${users.length} users matching search criteria`);
      },
      (error: AppError) => {
        this.logger.error(`Failed to search users: ${error.message}`);
      },
    );

    return result;
  }
}
