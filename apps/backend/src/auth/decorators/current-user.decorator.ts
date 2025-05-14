import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { SessionUser } from "@repo/auth/config";

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
