import { Module } from "@nestjs/common";

import { FeedController } from "./feed.controller";
import { FeedRepository } from "./feed.repository";

/** Personal activity feed for the dashboard (read-only over existing tables). */
@Module({
  controllers: [FeedController],
  providers: [FeedRepository],
})
export class FeedModule {}
