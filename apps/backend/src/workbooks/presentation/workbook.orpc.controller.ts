import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { workbookOrpcContract } from "@repo/api/domains/workbook/workbook.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { isSuccess } from "../../common/utils/fp-utils";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateWorkbookUseCase } from "../application/use-cases/create-workbook/create-workbook";
import { DeleteWorkbookUseCase } from "../application/use-cases/delete-workbook/delete-workbook";
import { GetWorkbookVersionUseCase } from "../application/use-cases/get-workbook-version/get-workbook-version";
import { GetWorkbookUseCase } from "../application/use-cases/get-workbook/get-workbook";
import { ListWorkbookVersionsUseCase } from "../application/use-cases/list-workbook-versions/list-workbook-versions";
import { ListWorkbooksUseCase } from "../application/use-cases/list-workbooks/list-workbooks";
import { UpdateWorkbookUseCase } from "../application/use-cases/update-workbook/update-workbook";
import type { CreateWorkbookDto, UpdateWorkbookDto } from "../core/models/workbook.model";

@Controller()
export class WorkbookOrpcController {
  private readonly logger = new Logger(WorkbookOrpcController.name);

  constructor(
    private readonly createWorkbookUseCase: CreateWorkbookUseCase,
    private readonly getWorkbookUseCase: GetWorkbookUseCase,
    private readonly listWorkbooksUseCase: ListWorkbooksUseCase,
    private readonly updateWorkbookUseCase: UpdateWorkbookUseCase,
    private readonly deleteWorkbookUseCase: DeleteWorkbookUseCase,
    private readonly listWorkbookVersionsUseCase: ListWorkbookVersionsUseCase,
    private readonly getWorkbookVersionUseCase: GetWorkbookVersionUseCase,
  ) {}

  @Implement(workbookOrpcContract.createWorkbook)
  createWorkbook(@Session() session: UserSession) {
    return implement(workbookOrpcContract.createWorkbook).handler(async ({ input }) => {
      const result = await this.createWorkbookUseCase.execute(
        input as CreateWorkbookDto,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookOrpcContract.getWorkbook)
  getWorkbook(@Session() session: UserSession) {
    return implement(workbookOrpcContract.getWorkbook).handler(async ({ input }) => {
      const result = await this.getWorkbookUseCase.execute(input.id, session.user.id);

      if (isSuccess(result)) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookOrpcContract.listWorkbooks)
  listWorkbooks(@Session() session: UserSession) {
    return implement(workbookOrpcContract.listWorkbooks).handler(async ({ input }) => {
      const result = await this.listWorkbooksUseCase.execute({
        search: input.search,
        filter: input.filter,
        userId: session.user.id,
      });

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookOrpcContract.updateWorkbook)
  updateWorkbook(@Session() session: UserSession) {
    return implement(workbookOrpcContract.updateWorkbook).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.updateWorkbookUseCase.execute(
        id,
        body as UpdateWorkbookDto,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookOrpcContract.deleteWorkbook)
  deleteWorkbook(@Session() session: UserSession) {
    return implement(workbookOrpcContract.deleteWorkbook).handler(async ({ input }) => {
      const result = await this.deleteWorkbookUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookOrpcContract.listWorkbookVersions)
  listWorkbookVersions() {
    return implement(workbookOrpcContract.listWorkbookVersions).handler(async ({ input }) => {
      const result = await this.listWorkbookVersionsUseCase.execute(input.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookOrpcContract.getWorkbookVersion)
  getWorkbookVersion() {
    return implement(workbookOrpcContract.getWorkbookVersion).handler(async ({ input }) => {
      const result = await this.getWorkbookVersionUseCase.execute(input.versionId);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
