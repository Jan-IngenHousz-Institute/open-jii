import { Injectable } from "@nestjs/common";

import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { isSuccess } from "../../../utils/fp-utils";

export interface UserDto {
  id: string;
  name: string;
}

@Injectable()
export class GetUsersNotOnExperimentUseCase {
  constructor(
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(experimentId: string) {
    // You could add authorization check here if needed
    // For now, we'll assume any user can see available users

    // Get users not in experiment
    const usersResult =
      await this.experimentMemberRepository.getUsersNotOnExperiment(
        experimentId,
      );

    if (!isSuccess(usersResult)) {
      return usersResult;
    }

    return usersResult;
  }
}
