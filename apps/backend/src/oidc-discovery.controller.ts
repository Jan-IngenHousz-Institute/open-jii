import { Controller, Get, Res } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";

import { auth } from "@repo/auth/server";

@AllowAnonymous()
@Controller(".well-known")
export class OidcDiscoveryController {
  // The Better Auth module only forwards requests beneath /api/v1/auth.
  @Get("oauth-authorization-server/api/v1/auth")
  async getAuthorizationServer(@Res({ passthrough: true }) response: Response) {
    const metadata = await auth.api.getOAuthServerConfig();
    response.setHeader("Cache-Control", "public, max-age=3600");
    return metadata;
  }
}
