import { Module } from "@nestjs/common";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { getAuth } from "./better-auth";

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      useFactory: async () => {
        const auth = await getAuth();
        return {
          auth,
        };
      },
    }),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}
