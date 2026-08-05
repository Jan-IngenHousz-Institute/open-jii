import { Controller, Headers, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { WORKBOOK_CAPABILITIES_HEADER } from "@repo/api/domains/workbook/workbook-capabilities";
import { workbookContract } from "@repo/api/domains/workbook/workbook.contract";

import { AuthorizationService } from "../../authorization/authorization.service";
import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { resolveResourceCapabilities } from "../../authorization/resource-capabilities";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { isSuccess } from "../../common/utils/fp-utils";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { requireWorkbookCellsCapability } from "../../common/utils/workbook-capabilities";
import { SetVisibilityUseCase } from "../../visibility/application/use-cases/set-visibility/set-visibility";
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
    private readonly setVisibilityUseCase: SetVisibilityUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  @CanCreateInOrg()
  @Implement(workbookContract.createWorkbook)
  createWorkbook(
    @Session() session: UserSession,
    @Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string,
  ) {
    return implement(workbookContract.createWorkbook).handler(async ({ input }) => {
      if (input.cells) requireWorkbookCellsCapability(input.cells, capabilityHeader);
      const result = await this.createWorkbookUseCase.execute(
        input as CreateWorkbookDto,
        session.user.id,
        input.organizationId ?? null,
      );

      if (result.isSuccess()) {
        requireWorkbookCellsCapability(result.value.cells, capabilityHeader);
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "workbook", action: "read" })
  @Implement(workbookContract.getWorkbook)
  getWorkbook(
    @Session() session: UserSession,
    @Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string,
  ) {
    return implement(workbookContract.getWorkbook).handler(async ({ input }) => {
      const result = await this.getWorkbookUseCase.execute(input.id);

      if (isSuccess(result)) {
        requireWorkbookCellsCapability(result.value.cells, capabilityHeader);
        // See the macro controller: capabilities drive capability-gated UI.
        const capabilities = await resolveResourceCapabilities(
          this.authz,
          session.user.id,
          "workbook",
          input.id,
        );
        return { ...formatDates(result.value), capabilities };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(workbookContract.listWorkbooks)
  listWorkbooks(@Session() session: UserSession) {
    return implement(workbookContract.listWorkbooks).handler(async ({ input }) => {
      const result = await this.listWorkbooksUseCase.execute({
        search: input.search,
        filter: input.filter,
        userId: session.user.id,
      });

      if (result.isSuccess()) return formatDatesList(result.value);

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "workbook", action: "update" })
  @Implement(workbookContract.updateWorkbook)
  updateWorkbook(
    @Session() session: UserSession,
    @Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string,
  ) {
    return implement(workbookContract.updateWorkbook).handler(async ({ input }) => {
      const { id, ...body } = input;
      if (body.cells) requireWorkbookCellsCapability(body.cells, capabilityHeader);
      const result = await this.updateWorkbookUseCase.execute(
        id,
        body as UpdateWorkbookDto,
        session.user.id,
      );

      if (result.isSuccess()) {
        requireWorkbookCellsCapability(result.value.cells, capabilityHeader);
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "workbook", action: "manage" })
  @Implement(workbookContract.setVisibility)
  setVisibility() {
    return implement(workbookContract.setVisibility).handler(async ({ input }) => {
      const result = await this.setVisibilityUseCase.execute(
        "workbook",
        input.id,
        input.visibility,
      );
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "workbook", action: "manage" })
  @Implement(workbookContract.deleteWorkbook)
  deleteWorkbook(@Session() session: UserSession) {
    return implement(workbookContract.deleteWorkbook).handler(async ({ input }) => {
      const result = await this.deleteWorkbookUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "workbook", action: "read" })
  @Implement(workbookContract.listWorkbookVersions)
  listWorkbookVersions() {
    return implement(workbookContract.listWorkbookVersions).handler(async ({ input }) => {
      const result = await this.listWorkbookVersionsUseCase.execute(input.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "workbook", action: "read" })
  @Implement(workbookContract.getWorkbookVersion)
  getWorkbookVersion(@Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string) {
    return implement(workbookContract.getWorkbookVersion).handler(async ({ input }) => {
      const result = await this.getWorkbookVersionUseCase.execute(input.versionId, input.id);

      if (result.isSuccess()) {
        requireWorkbookCellsCapability(result.value.cells, capabilityHeader);
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
