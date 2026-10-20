import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { visitContract } from "@repo/api/domains/visit/visit.contract";
import { DEFAULT_RECENTLY_OPENED_RESOURCES_LIMIT } from "@repo/api/domains/visit/visit.schema";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListRecentlyOpenedUseCase } from "../application/use-cases/list-recently-opened/list-recently-opened";
import { RecordVisitUseCase } from "../application/use-cases/record-visit/record-visit";

/** Access is checked in the use cases: before a visit is recorded, and per row on the list. */
@Controller()
export class VisitController {
  private readonly logger = new Logger(VisitController.name);

  constructor(
    private readonly recordVisitUseCase: RecordVisitUseCase,
    private readonly listRecentlyOpenedUseCase: ListRecentlyOpenedUseCase,
  ) {}

  @Implement(visitContract.recordVisit)
  recordVisit(@Session() session: UserSession) {
    return implement(visitContract.recordVisit).handler(async ({ input }) => {
      const result = await this.recordVisitUseCase.execute(
        session.user.id,
        input.resourceType,
        input.resourceId,
      );
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(visitContract.listRecentlyOpened)
  listRecentlyOpened(@Session() session: UserSession) {
    return implement(visitContract.listRecentlyOpened).handler(async ({ input }) => {
      const result = await this.listRecentlyOpenedUseCase.execute(
        session.user.id,
        input.limit ?? DEFAULT_RECENTLY_OPENED_RESOURCES_LIMIT,
        input.type,
      );
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
