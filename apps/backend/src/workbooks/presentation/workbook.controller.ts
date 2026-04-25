import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { workbookContract } from "@repo/api/contracts/workbook.contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure, isSuccess } from "../../common/utils/fp-utils";
import { CreateWorkbookUseCase } from "../application/use-cases/create-workbook/create-workbook";
import { DeleteWorkbookUseCase } from "../application/use-cases/delete-workbook/delete-workbook";
import { GetWorkbookVersionUseCase } from "../application/use-cases/get-workbook-version/get-workbook-version";
import { GetWorkbookUseCase } from "../application/use-cases/get-workbook/get-workbook";
import { ListWorkbookVersionsUseCase } from "../application/use-cases/list-workbook-versions/list-workbook-versions";
import { ListWorkbooksUseCase } from "../application/use-cases/list-workbooks/list-workbooks";
import { UpdateWorkbookUseCase } from "../application/use-cases/update-workbook/update-workbook";
import type { CreateWorkbookDto, UpdateWorkbookDto } from "../core/models/workbook.model";

@Controller()
export class WorkbookController {
  private readonly logger = new Logger(WorkbookController.name);

  constructor(
    private readonly createWorkbookUseCase: CreateWorkbookUseCase,
    private readonly getWorkbookUseCase: GetWorkbookUseCase,
    private readonly listWorkbooksUseCase: ListWorkbooksUseCase,
    private readonly updateWorkbookUseCase: UpdateWorkbookUseCase,
    private readonly deleteWorkbookUseCase: DeleteWorkbookUseCase,
    private readonly listWorkbookVersionsUseCase: ListWorkbookVersionsUseCase,
    private readonly getWorkbookVersionUseCase: GetWorkbookVersionUseCase,
  ) {}

  @TsRestHandler(workbookContract.createWorkbook)
  createWorkbook(@Session() session: UserSession) {
    return tsRestHandler(workbookContract.createWorkbook, async ({ body }) => {
      const result = await this.createWorkbookUseCase.execute(
        body as CreateWorkbookDto,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(workbookContract.getWorkbook)
  getWorkbook(@Session() session: UserSession) {
    return tsRestHandler(workbookContract.getWorkbook, async ({ params }) => {
      const result = await this.getWorkbookUseCase.execute(params.id, session.user.id);

      if (isSuccess(result)) {
        return {
          status: StatusCodes.OK,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(workbookContract.listWorkbooks)
  listWorkbooks(@Session() session: UserSession) {
    return tsRestHandler(workbookContract.listWorkbooks, async ({ query }) => {
      const result = await this.listWorkbooksUseCase.execute({
        search: query.search,
        filter: query.filter,
        userId: session.user.id,
      });

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(workbookContract.updateWorkbook)
  updateWorkbook(@Session() session: UserSession) {
    return tsRestHandler(workbookContract.updateWorkbook, async ({ params, body }) => {
      const result = await this.updateWorkbookUseCase.execute(
        params.id,
        body as UpdateWorkbookDto,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(workbookContract.deleteWorkbook)
  deleteWorkbook(@Session() session: UserSession) {
    return tsRestHandler(workbookContract.deleteWorkbook, async ({ params }) => {
      const result = await this.deleteWorkbookUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.NO_CONTENT,
          body: undefined,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(workbookContract.listWorkbookVersions)
  listWorkbookVersions() {
    return tsRestHandler(workbookContract.listWorkbookVersions, async ({ params }) => {
      const result = await this.listWorkbookVersionsUseCase.execute(params.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(workbookContract.getWorkbookVersion)
  getWorkbookVersion() {
    return tsRestHandler(workbookContract.getWorkbookVersion, async ({ params }) => {
      const result = await this.getWorkbookVersionUseCase.execute(params.versionId);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
