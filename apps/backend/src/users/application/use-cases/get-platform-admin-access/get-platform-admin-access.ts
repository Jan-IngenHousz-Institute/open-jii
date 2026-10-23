import { Injectable } from "@nestjs/common";

import { isPlatformAdmin } from "@repo/auth/platform-admin";

import { success } from "../../../../common/utils/fp-utils";

@Injectable()
export class GetPlatformAdminAccessUseCase {
  async execute(user: { id: string; isAnonymous?: boolean }, headers: Headers) {
    return success({ isPlatformAdmin: await isPlatformAdmin(user, headers) });
  }
}
