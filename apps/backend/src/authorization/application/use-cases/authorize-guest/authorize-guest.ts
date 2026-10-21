import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { GUEST_UPLOAD_MAX_BYTES } from "@repo/api/shared/guest";

import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import { GUEST_IDENTITY_PORT } from "../../../../users/core/ports/guest-identity.port";
import type { GuestIdentityPort } from "../../../../users/core/ports/guest-identity.port";
import { matchGuestRoute } from "../../../core/models/guest-route.model";
import { DEMO_MODE_PORT } from "../../../core/ports/demo-mode.port";
import type { DemoModePort } from "../../../core/ports/demo-mode.port";
import { GUEST_RESOURCE_PORT } from "../../../core/ports/guest-resource.port";
import type { GuestResourcePort } from "../../../core/ports/guest-resource.port";

interface GuestRequest {
  userId: string;
  token?: string;
  method: string;
  path: string;
  body: unknown;
}

const visit = z.object({
  resourceType: z.enum(["experiment", "macro", "protocol", "workbook"]),
  resourceId: z.string().uuid(),
  userId: z.never().optional(),
});

@Injectable()
export class AuthorizeGuestUseCase {
  constructor(
    @Inject(GUEST_IDENTITY_PORT) private readonly guests: GuestIdentityPort,
    @Inject(GUEST_RESOURCE_PORT) private readonly resources: GuestResourcePort,
    @Inject(DEMO_MODE_PORT) private readonly demo: DemoModePort,
  ) {}

  async execute(request: GuestRequest) {
    const identity = await this.guests.findIdentity(request.userId);
    if (!identity) return failure(AppError.unauthorized("This session is no longer valid"));
    if (!identity.isAnonymous) return success({ guest: false });
    if (!request.token || !(await this.guests.hasSession(request.userId, request.token))) {
      return failure(AppError.unauthorized("This guest session has ended"));
    }
    const matched = matchGuestRoute(request.method, request.path);
    const denied = () =>
      failure(
        AppError.forbidden("This action is not available to guests", "GUEST_ACTION_FORBIDDEN"),
      );
    if (!matched || matched.route.classification === "deny") return denied();
    const { route, params } = matched;
    if (route.classification === "public-list") return success({ guest: true });
    if (route.classification === "visit") {
      const parsed = visit.safeParse(request.body);
      if (!parsed.success) return denied();
      const resource = await this.resources.findOwnership(
        parsed.data.resourceType,
        parsed.data.resourceId,
      );
      return resource?.visibility === "public" ? success({ guest: true }) : denied();
    }
    if (route.classification === "public-resource") {
      const id = z.string().uuid().safeParse(params.id);
      if (!id.success || !route.resource) return denied();
      const resource = await this.resources.findOwnership(route.resource, id.data);
      return resource?.visibility === "public" ? success({ guest: true }) : denied();
    }
    if (!(await this.demo.isEnabled()))
      return failure(AppError.forbidden("The demo is currently unavailable", "DEMO_DISABLED"));
    const upload = route.classification === "demo-upload";
    let id = params.id;
    if (upload) {
      const input = z
        .object({
          experimentId: z.string().uuid(),
          contentLength: z.number().int().positive().max(GUEST_UPLOAD_MAX_BYTES),
        })
        .safeParse(request.body);
      if (!input.success)
        return failure(
          AppError.badRequest(
            "Guest uploads require a payload size of at most 1 MiB",
            "GUEST_UPLOAD_SIZE_INVALID",
          ),
        );
      id = input.data.experimentId;
    }
    if (!z.string().uuid().safeParse(id).success) return denied();
    const resource = await this.resources.findOwnership(upload ? "experiment" : "macro", id);
    if (resource?.organizationType !== "demo" || resource.visibility !== "public") return denied();
    const quota = await this.guests.takeQuota(request.userId, upload ? "upload" : "macro");
    if (!quota.allowed)
      return failure(
        new AppError("Guest limit reached. Try again shortly", "GUEST_RATE_LIMITED", 429, {
          retryAfterSeconds: quota.retryAfterSeconds,
        }),
      );
    return success({ guest: true });
  }
}
