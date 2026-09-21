import {
  Controller,
  HttpCode,
  HttpException,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";
import { rm } from "node:fs/promises";
import { z } from "zod";

import { assistantKnowledgeContract } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AssistantKnowledgeService } from "../assistant-knowledge.service";
import { AssistantKnowledgeUploadService } from "../infrastructure/assistant-knowledge-upload.service";

@Controller()
export class AssistantKnowledgeController {
  private readonly logger = new Logger(AssistantKnowledgeController.name);

  constructor(
    private readonly service: AssistantKnowledgeService,
    private readonly uploadService: AssistantKnowledgeUploadService,
  ) {}

  @Implement(assistantKnowledgeContract.getCapabilities)
  getCapabilities(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.getCapabilities).handler(() =>
      this.service.getCapabilities(session.user.id),
    );
  }

  @Implement(assistantKnowledgeContract.searchKnowledge)
  searchKnowledge(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.searchKnowledge).handler(async ({ input }) => {
      const result = await this.service.search(session.user.id, input);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "searchKnowledge");
    });
  }

  @Implement(assistantKnowledgeContract.listCorpusWorks)
  listCorpusWorks(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.listCorpusWorks).handler(async ({ input }) => {
      const result = await this.service.listCorpusWorks(
        session.user.id,
        input.organizationId,
        input.includeRemoved,
      );
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "listCorpusWorks");
    });
  }

  @Implement(assistantKnowledgeContract.getCorpusWork)
  getCorpusWork(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.getCorpusWork).handler(async ({ input }) => {
      const result = await this.service.getCorpusWork(session.user.id, input.workId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "getCorpusWork");
    });
  }

  @Implement(assistantKnowledgeContract.createCorpusWork)
  createCorpusWork(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.createCorpusWork).handler(async ({ input }) => {
      const result = await this.service.createCorpusWork(session.user.id, input);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "createCorpusWork");
    });
  }

  @Implement(assistantKnowledgeContract.parseCorpusWork)
  parseCorpusWork(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.parseCorpusWork).handler(async ({ input }) => {
      const result = await this.service.parseCorpusWork(session.user.id, input.workId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "parseCorpusWork");
    });
  }

  @Implement(assistantKnowledgeContract.reviewCorpusWork)
  reviewCorpusWork(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.reviewCorpusWork).handler(async ({ input }) => {
      const result = await this.service.reviewCorpusWork(session.user.id, input);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "reviewCorpusWork");
    });
  }

  @Implement(assistantKnowledgeContract.admitCorpusWork)
  admitCorpusWork(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.admitCorpusWork).handler(async ({ input }) => {
      const result = await this.service.admitCorpusWork(session.user.id, input.workId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "admitCorpusWork");
    });
  }

  @Implement(assistantKnowledgeContract.removeCorpusWork)
  removeCorpusWork(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.removeCorpusWork).handler(async ({ input }) => {
      const result = await this.service.removeCorpusWork(session.user.id, input.workId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "removeCorpusWork");
    });
  }

  @Implement(assistantKnowledgeContract.listDocuments)
  listDocuments(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.listDocuments).handler(async ({ input }) => {
      const result = await this.service.listDocuments(session.user.id, input.organizationId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "listDocuments");
    });
  }

  @Implement(assistantKnowledgeContract.getDocument)
  getDocument(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.getDocument).handler(async ({ input }) => {
      const result = await this.service.getDocument(session.user.id, input.documentId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "getDocument");
    });
  }

  @Implement(assistantKnowledgeContract.parseDocument)
  parseDocument(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.parseDocument).handler(async ({ input }) => {
      const result = await this.service.parseDocument(session.user.id, input.documentId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "parseDocument");
    });
  }

  @Implement(assistantKnowledgeContract.deleteDocument)
  deleteDocument(@Session() session: UserSession) {
    return implement(assistantKnowledgeContract.deleteDocument).handler(async ({ input }) => {
      const result = await this.service.deleteDocument(session.user.id, input.documentId);
      return result.isSuccess()
        ? result.value
        : throwOrpcFailure(result, this.logger, "deleteDocument");
    });
  }

  @Post("/api/v1/assistant-knowledge/documents")
  @HttpCode(201)
  async uploadDocument(@Session() session: UserSession, @Req() request: Request) {
    const documentId = crypto.randomUUID();
    let uploadedPath: string | null = null;
    try {
      const upload = await this.uploadService.receive(request, {
        scope: "documents",
        ownerId: session.user.id,
        recordId: documentId,
      });
      uploadedPath = upload.localFilePath;
      const organizationId = z.string().uuid().safeParse(upload.fields.organizationId);
      if (!organizationId.success) {
        throw new HttpException(
          { message: "organizationId must name an organization the uploader belongs to." },
          400,
        );
      }
      const result = await this.service.registerDocumentUpload(session.user.id, {
        id: documentId,
        organizationId: organizationId.data,
        fileName: upload.fileName,
        mediaType: upload.mediaType,
        byteSize: upload.byteSize,
        localFilePath: upload.localFilePath,
      });
      if (result.isFailure()) {
        throw new HttpException(
          { message: result.error.message, code: result.error.code },
          result.error.statusCode,
        );
      }
      return result.value;
    } catch (error) {
      if (uploadedPath) {
        await rm(uploadedPath, { force: true });
      }
      this.throwHttp(error, "uploadDocument");
    }
  }

  @Post("/api/v1/assistant-knowledge/corpus/:workId/file")
  @HttpCode(201)
  async uploadCorpusFile(
    @Param("workId", ParseUUIDPipe) workId: string,
    @Session() session: UserSession,
    @Req() request: Request,
  ) {
    let uploadedPath: string | null = null;
    try {
      const upload = await this.uploadService.receive(request, {
        scope: "corpus",
        ownerId: session.user.id,
        recordId: workId,
      });
      uploadedPath = upload.localFilePath;
      const result = await this.service.attachCorpusFile(session.user.id, workId, {
        fileName: upload.fileName,
        localFilePath: upload.localFilePath,
      });
      if (result.isFailure()) {
        throw new HttpException(
          { message: result.error.message, code: result.error.code },
          result.error.statusCode,
        );
      }
      return result.value;
    } catch (error) {
      if (uploadedPath) {
        await rm(uploadedPath, { force: true });
      }
      this.throwHttp(error, "uploadCorpusFile");
    }
  }

  private throwHttp(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    const appError = error as { message?: string; code?: string; statusCode?: number };
    const status = appError.statusCode ?? 500;
    const message = appError.message ?? "Assistant knowledge request failed";
    if (status >= 500) {
      this.logger.error({ msg: message, operation, error });
    } else {
      this.logger.warn({ msg: message, operation });
    }
    throw new HttpException({ message, code: appError.code ?? "INTERNAL_ERROR" }, status);
  }
}
