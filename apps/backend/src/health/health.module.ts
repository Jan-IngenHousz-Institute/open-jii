import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { HealthController } from "./health.controller";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "health-time",
        ttl: 60_000,
        limit: 30,
      },
    ]),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
