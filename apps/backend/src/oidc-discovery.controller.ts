import { Controller, Get, Header } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { auth } from "@repo/auth/server";

@AllowAnonymous()
@Controller(".well-known")
export class OidcDiscoveryController {
  // The Better Auth module only forwards requests beneath /api/v1/auth.
  @Get("oauth-authorization-server/api/v1/auth")
  @Header("Cache-Control", "public, max-age=3600")
  getAuthorizationServer() {
    return auth.api.getOAuthServerConfig();
  }
}
