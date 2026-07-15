import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { searchContract } from "@repo/api/domains/search/search.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GlobalSearchUseCase } from "../application/use-cases/global-search/global-search";

@Controller()
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly globalSearchUseCase: GlobalSearchUseCase) {}

  @Implement(searchContract.globalSearch)
  globalSearch(@Session() session: UserSession) {
    return implement(searchContract.globalSearch).handler(async ({ input }) => {
      const result = await this.globalSearchUseCase.execute(
        session.user.id,
        input.query,
        input.limit,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "globalSearch");
    });
  }
}
