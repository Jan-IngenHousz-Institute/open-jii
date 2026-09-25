import { Injectable, Inject, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";

import type { StatementParameter } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, failure, Result, success } from "../../../common/utils/fp-utils";
import {
  BaseTransferRequest,
  CreateTransferRequestDto,
} from "../models/project-transfer-request.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

@Injectable()
export class ProjectTransferRequestsRepository {
  private readonly logger = new Logger(ProjectTransferRequestsRepository.name);

  constructor(
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Helper function to parse a Databricks result row into BaseTransferRequest
   */
  private parseTransferRequestRow(
    row: (string | null)[],
    columns: { name: string }[],
  ): BaseTransferRequest {
    const getColumnValue = (columnName: string): string => {
      const idx = columns.findIndex((col) => col.name === columnName);
      return row[idx] ?? "";
    };

    return {
      requestId: getColumnValue("request_id"),
      userId: getColumnValue("user_id"),
      userEmail: getColumnValue("user_email"),
      sourcePlatform: getColumnValue("source_platform"),
      projectIdOld: getColumnValue("project_id_old"),
      projectUrlOld: getColumnValue("project_url_old"),
      status: getColumnValue("status"),
      requestedAt: new Date(getColumnValue("requested_at")),
    };
  }

  // Zod validation schemas
  private readonly schemas = {
    uuid: z.string().uuid(),
    email: z.string().min(1).max(100),
    url: z.string().url(),
    projectId: z.string().min(1).max(255),
    sourcePlatform: z.string().min(1).max(100),
    status: z.string().min(1).max(100),
  };

  /**
   * Validate input parameters
   */
  private validate = {
    uuid: (value: string) => this.schemas.uuid.safeParse(value),
    email: (value: string) => this.schemas.email.safeParse(value),
    url: (value: string) => this.schemas.url.safeParse(value),
    projectId: (value: string) => this.schemas.projectId.safeParse(value),
    sourcePlatform: (value: string) => this.schemas.sourcePlatform.safeParse(value),
    status: (value: string) => this.schemas.status.safeParse(value),

    transferRequest: (request: CreateTransferRequestDto & { requestId: string }): boolean => {
      const validations = [
        this.validate.uuid(request.requestId),
        this.validate.uuid(request.userId),
        this.validate.email(request.userEmail),
        this.validate.sourcePlatform(request.sourcePlatform),
        this.validate.projectId(request.projectIdOld),
        this.validate.url(request.projectUrlOld),
        this.validate.status(request.status),
      ];

      return validations.every((result) => result.success);
    },
  };

  /**
   * Store a new transfer request in the centrum schema
   */
  async createTransferRequest(
    request: CreateTransferRequestDto,
  ): Promise<Result<BaseTransferRequest>> {
    this.logger.log({
      msg: "Creating transfer request",
      operation: "createTransferRequest",
      userId: request.userId,
    });

    const now = new Date();
    const requestId = randomUUID().toString();

    const requestWithId: Omit<BaseTransferRequest, "requestedAt"> = {
      ...request,
      requestId,
    };

    // Validate the request
    if (!this.validate.transferRequest(requestWithId)) {
      return failure(
        AppError.validationError(
          `Validation failed for transfer request: ${JSON.stringify(request)}`,
        ),
      );
    }

    // Build INSERT query
    const insertQuery = `
      INSERT INTO openjii_project_transfer_requests (
        request_id,
        user_id,
        user_email,
        source_platform,
        project_id_old,
        project_url_old,
        status,
        requested_at
      ) VALUES (
        :request_id,
        :user_id,
        :user_email,
        :source_platform,
        :project_id_old,
        :project_url_old,
        :status,
        :requested_at
      )
    `;
    const parameters: StatementParameter[] = [
      { name: "request_id", value: requestId },
      { name: "user_id", value: request.userId },
      { name: "user_email", value: request.userEmail },
      { name: "source_platform", value: request.sourcePlatform },
      { name: "project_id_old", value: request.projectIdOld },
      { name: "project_url_old", value: request.projectUrlOld },
      { name: "status", value: request.status },
      { name: "requested_at", value: now.toISOString(), type: "TIMESTAMP" },
    ];

    const insertResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      insertQuery,
      parameters,
    );
    if (insertResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to insert transfer request: ${insertResult.error.message}`),
      );
    }

    return success({
      ...requestWithId,
      requestedAt: now,
    });
  }

  /**
   * List all transfer requests (optionally filtered by user)
   */
  async listTransferRequests(userId?: string): Promise<Result<BaseTransferRequest[]>> {
    this.logger.log({
      msg: "Listing transfer requests",
      operation: "listTransferRequests",
      ...(userId && { userId }),
    });

    if (userId) {
      const userIdValidation = this.validate.uuid(userId);
      if (!userIdValidation.success) {
        return failure(AppError.validationError("Invalid user ID"));
      }
    }

    // Build SELECT query
    const whereClause = userId ? "WHERE user_id = :user_id" : "";
    const selectQuery = `
      SELECT 
        request_id,
        user_id,
        user_email,
        source_platform,
        project_id_old,
        project_url_old,
        status,
        requested_at
      FROM openjii_project_transfer_requests
      ${whereClause}
      ORDER BY requested_at DESC
    `;

    const selectResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      selectQuery,
      userId ? [{ name: "user_id", value: userId }] : undefined,
    );
    if (selectResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to list transfer requests: ${selectResult.error.message}`),
      );
    }

    // Parse the results
    const requests: BaseTransferRequest[] = selectResult.value.rows.map((row) =>
      this.parseTransferRequestRow(row, selectResult.value.columns),
    );

    return success(requests);
  }

  /**
   * Check if a transfer request already exists for a user and project
   */
  async findExistingRequest(
    userId: string,
    projectIdOld: string,
  ): Promise<Result<BaseTransferRequest | null>> {
    this.logger.log({
      msg: "Checking for existing transfer request",
      operation: "findExistingRequest",
      userId,
      projectIdOld,
    });

    // Validate inputs
    const userIdValidation = this.validate.uuid(userId);
    if (!userIdValidation.success) {
      return failure(AppError.validationError("Invalid user ID"));
    }

    const projectIdValidation = this.validate.projectId(projectIdOld);
    if (!projectIdValidation.success) {
      return failure(AppError.validationError("Invalid project ID"));
    }

    // Build SELECT query
    const selectQuery = `
      SELECT 
        request_id,
        user_id,
        user_email,
        source_platform,
        project_id_old,
        project_url_old,
        status,
        requested_at
      FROM openjii_project_transfer_requests
      WHERE user_id = :user_id AND project_id_old = :project_id_old
      LIMIT 1
    `;

    const selectResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      selectQuery,
      [
        { name: "user_id", value: userId },
        { name: "project_id_old", value: projectIdOld },
      ],
    );
    if (selectResult.isFailure()) {
      return failure(
        AppError.internal(
          `Failed to check for existing transfer request: ${selectResult.error.message}`,
        ),
      );
    }

    // Check if request exists
    if (selectResult.value.rows.length === 0) {
      return success(null);
    }

    // Parse the result
    const row = selectResult.value.rows[0];
    const request = this.parseTransferRequestRow(row, selectResult.value.columns);

    return success(request);
  }
}
