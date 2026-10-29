import { Inject, Injectable } from "@nestjs/common";

import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import { GUEST_IDENTITY_PORT } from "../../../../users/core/ports/guest-identity.port";
import type { GuestIdentityPort } from "../../../../users/core/ports/guest-identity.port";
import { matchGuestRoute } from "../../../core/models/guest-route.model";

interface GuestRequest {
  userId: string;
  isAnonymous: boolean;
  token?: string;
  method: string;
  path: string;
  hasAccessRequirement: boolean;
}

@Injectable()
export class AuthorizeGuestUseCase {
  constructor(@Inject(GUEST_IDENTITY_PORT) private readonly guests: GuestIdentityPort) {}

  async execute(request: GuestRequest) {
    if (!request.isAnonymous) return success({ guest: false });
    const identity = await this.guests.findIdentity(request.userId);
    if (!identity?.isAnonymous)
      return failure(AppError.unauthorized("This session is no longer valid"));
    if (!request.token || !(await this.guests.hasSession(request.userId, request.token))) {
      return failure(AppError.unauthorized("This guest session has ended"));
    }
    if (request.method !== "HEAD" && request.hasAccessRequirement) return success({ guest: true });
    const matched = matchGuestRoute(request.method, request.path);
    if (matched?.route.classification === "public-list") return success({ guest: true });
    return failure(
      AppError.forbidden("This action is not available to guests", "GUEST_ACTION_FORBIDDEN"),
    );
  }
}
