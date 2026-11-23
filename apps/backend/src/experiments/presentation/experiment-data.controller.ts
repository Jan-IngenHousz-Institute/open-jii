import { Controller, Logger, Req } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AuthService, Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";

import { experimentDataContract } from "@repo/api/domains/experiment/data/experiment-data.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ExperimentDataSourceService } from "../application/services/experiment-data-source.service";
import { GetDistinctColumnValuesUseCase } from "../application/use-cases/experiment-data/get-distinct-column-values";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTableColumnsUseCase } from "../application/use-cases/experiment-data/get-experiment-table-columns";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";
import { WatchExperimentTablesUseCase } from "../application/use-cases/experiment-data/watch-experiment-tables";
import type { StreamSignIn } from "../application/use-cases/experiment-data/watch-experiment-tables";

@Controller()
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly getExperimentTablesUseCase: GetExperimentTablesUseCase,
    private readonly getDistinctColumnValuesUseCase: GetDistinctColumnValuesUseCase,
    private readonly getExperimentTableColumnsUseCase: GetExperimentTableColumnsUseCase,
    private readonly watchExperimentTablesUseCase: WatchExperimentTablesUseCase,
    private readonly dataSource: ExperimentDataSourceService,
    private readonly authService: AuthService,
  ) {}

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getExperimentTables)
  getExperimentTables(@Session() session: UserSession) {
    return implement(experimentDataContract.getExperimentTables).handler(async ({ input }) => {
      const source = await this.dataSource.sourceFor(session.user);
      const result = await this.getExperimentTablesUseCase.execute(
        input.id,
        session.user.id,
        source,
      );
      if (result.isSuccess()) {
        return { headers: { "x-data-source": source }, body: result.value };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.watchExperimentTables)
  watchExperimentTables(@Session() session: UserSession, @Req() request: Request) {
    const headers = fromNodeHeaders(request.headers);
    // A key signs its request in with a session whose id is the key's own.
    const signIn: StreamSignIn = this.isApiKeySession(session, request)
      ? { kind: "apiKey", id: session.session.id }
      : {
          kind: "session",
          id: session.session.id,
          isSignedIn: () => this.isSignedIn(headers, session.user.id),
        };
    return implement(experimentDataContract.watchExperimentTables).handler(
      async ({ input, signal }) => {
        const source = await this.dataSource.sourceFor(session.user);
        const result = this.watchExperimentTablesUseCase.execute(
          input.id,
          session.user.id,
          source,
          signIn,
          signal,
        );
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getExperimentData)
  getExperimentData(@Session() session: UserSession) {
    return implement(experimentDataContract.getExperimentData).handler(async ({ input }) => {
      const { id, ...query } = input;
      const source = await this.dataSource.sourceFor(session.user);
      const result = await this.getExperimentDataUseCase.execute(
        id,
        session.user.id,
        query,
        source,
      );
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getDistinctColumnValues)
  getDistinctColumnValues(@Session() session: UserSession) {
    return implement(experimentDataContract.getDistinctColumnValues).handler(async ({ input }) => {
      const { id, ...query } = input;
      const source = await this.dataSource.sourceFor(session.user);
      const result = await this.getDistinctColumnValuesUseCase.execute(
        id,
        session.user.id,
        query,
        source,
      );
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getExperimentTableColumns)
  getExperimentTableColumns(@Session() session: UserSession) {
    return implement(experimentDataContract.getExperimentTableColumns).handler(
      async ({ input }) => {
        const { id, ...query } = input;
        const source = await this.dataSource.sourceFor(session.user);
        const result = await this.getExperimentTableColumnsUseCase.execute(
          id,
          session.user.id,
          query,
          source,
        );
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  /** Better Auth gives a request it signed in by its API key a session whose token is the key. */
  private isApiKeySession(session: UserSession, request: Request): boolean {
    const key = request.headers["x-api-key"];
    return typeof key === "string" && session.session.token === key;
  }

  // The session cookie caches a session for a day, so only the database knows it was revoked.
  private async isSignedIn(headers: Headers, userId: string): Promise<boolean> {
    const current = await this.authService.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    return current?.user.id === userId;
  }
}
