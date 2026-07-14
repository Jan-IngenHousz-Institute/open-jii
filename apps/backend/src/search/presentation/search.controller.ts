import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { searchContract } from "@repo/api/contracts/search.contract";

import { handleFailure } from "../../common/utils/fp-utils";
import { GlobalSearchUseCase } from "../application/use-cases/global-search/global-search";

@Controller()
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly globalSearchUseCase: GlobalSearchUseCase) {}

  @TsRestHandler(searchContract.globalSearch)
  globalSearch(@Session() session: UserSession) {
    return tsRestHandler(searchContract.globalSearch, async ({ query }) => {
      const result = await this.globalSearchUseCase.execute(
        session.user.id,
        query.query,
        query.limit,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
