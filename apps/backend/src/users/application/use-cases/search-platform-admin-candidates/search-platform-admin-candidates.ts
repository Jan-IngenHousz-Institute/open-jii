import { Injectable } from "@nestjs/common";

import { isPlatformAdmin } from "@repo/auth/platform-admin";

import { AppError, failure } from "../../../../common/utils/fp-utils";
import { PlatformAdminRepository } from "../../../core/repositories/platform-admin.repository";

@Injectable()
export class SearchPlatformAdminCandidatesUseCase {
  constructor(private readonly repository: PlatformAdminRepository) {}
  async execute(user: { id: string; isAnonymous?: boolean }, headers: Headers, search: string) {
    if (!(await isPlatformAdmin(user, headers)))
      return failure(AppError.forbidden("Platform admin access required"));
    return this.repository.search(search);
  }
}
