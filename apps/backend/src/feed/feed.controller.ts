import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { handleFailure } from "../common/utils/fp-utils";
import { FeedRepository } from "./feed.repository";

@Controller()
export class FeedController {
  private readonly logger = new Logger(FeedController.name);

  constructor(private readonly feedRepository: FeedRepository) {}

  @TsRestHandler(contract.feed.getFeed)
  getFeed(@Session() session: UserSession) {
    return tsRestHandler(contract.feed.getFeed, async ({ query }) => {
      const result = await this.feedRepository.getFeed(session.user.id, query.limit ?? 20);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: result.value };
      }
      return handleFailure(result, this.logger);
    });
  }
}
