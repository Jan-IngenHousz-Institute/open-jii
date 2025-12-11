import { Module } from "@nestjs/common";
import { BetterAuthModule } from "@thallesp/nestjs-better-auth";

import { auth } from "./better-auth";

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
    }),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}
