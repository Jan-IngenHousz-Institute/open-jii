import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { searchContract } from "@repo/api/domains/search/search.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GlobalSearchUseCase } from "../application/use-cases/global-search/global-search";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly globalSearchUseCase: GlobalSearchUseCase,
  ) {}

  @Implement(searchContract.globalSearch)
  globalSearch(@Session() session: UserSession) {
    return implement(searchContract.globalSearch).handler(async ({ input }) => {
      const isCalibrationEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.CALIBRATION,
        session.user.email || session.user.id,
      );

      const result = await this.globalSearchUseCase.execute(
        session.user.id,
        input.query,
        input.limit,
        isCalibrationEnabled,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "globalSearch");
    });
  }
}
