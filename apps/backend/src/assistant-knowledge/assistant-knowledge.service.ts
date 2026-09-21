import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { rm } from "node:fs/promises";

import type {
  AssistantKnowledgeCapabilities,
  AssistantKnowledgeHit,
  AssistantKnowledgeSearchInput,
  AssistantKnowledgeSearchResponse,
  AssistantPrivateDocument,
  CorpusWork,
  CreateCorpusWorkInput,
  ReviewCorpusWorkInput,
} from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";
import { and, eq, organizationMembers } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AppError, Result, failure, success, tryCatch } from "../common/utils/fp-utils";
import type { StoredAssistantDocument, StoredCorpusWork } from "./core/assistant-knowledge.models";
import { publicCorpusWork, publicDocument } from "./core/assistant-knowledge.models";
import { AssistantKnowledgeStore } from "./infrastructure/assistant-knowledge.store";
import { DatabricksDocumentParser } from "./infrastructure/databricks-document-parser";
import { DatabricksGenieClient } from "./infrastructure/databricks-genie.client";
import { DocsRetriever } from "./infrastructure/docs-retriever";

export type AssistantKnowledgeSearchResult = Result<AssistantKnowledgeSearchResponse>;

export interface PublicGenieQuery {
  question: string;
  containsPrivateContext: false;
}

@Injectable()
export class AssistantKnowledgeService {
  private readonly genieSpaceId: string | null;

  constructor(
    @Inject("DATABASE") private readonly db: DatabaseInstance,
    configService: ConfigService,
    private readonly store: AssistantKnowledgeStore,
    private readonly docsRetriever: DocsRetriever,
    private readonly documentParser: DatabricksDocumentParser,
    private readonly genieClient: DatabricksGenieClient,
  ) {
    this.genieSpaceId = configService.get<string>("ASSISTANT_GENIE_SPACE_ID") ?? null;
  }

  async getCapabilities(userId: string): Promise<AssistantKnowledgeCapabilities> {
    const canSearchDocs = await this.docsRetriever.isAvailable();
    const canCurateCorpus = await this.isCuratorOfAnyOrganization(userId);
    const parserConfigured = this.documentParser.isConfigured();
    const genieConfigured = this.genieClient.isConfigured();
    return {
      canSearchDocs,
      canSearchCorpus: true,
      canUploadDocument: true,
      canCurateCorpus,
      canUseGenie: false,
      providers: {
        docs: canSearchDocs
          ? { state: "available", code: null, message: null }
          : {
              state: "unavailable",
              code: "DOCS_ROOT_UNAVAILABLE",
              message:
                "Documentation files were not found. Set ASSISTANT_DOCS_ROOT to apps/docs/content.",
            },
        documentIntelligence: parserConfigured
          ? { state: "available", code: null, message: null }
          : {
              state: "unconfigured",
              code: "DATABRICKS_NOT_CONFIGURED",
              message:
                "Document parsing needs ASSISTANT_DATABRICKS_VOLUME and working Databricks development credentials.",
            },
        genie: genieConfigured
          ? {
              state: "unavailable",
              code: "GENIE_TOOL_UNAVAILABLE",
              message: "Genie is configured, but no caller-facing assistant tool is wired.",
            }
          : {
              state: "unconfigured",
              code: this.genieSpaceId ? "GENIE_DATASET_NOT_PUBLIC" : "GENIE_NOT_CONFIGURED",
              message: this.genieSpaceId
                ? "Genie stays disabled until ASSISTANT_GENIE_PUBLIC_DATASET_CONFIRMED=true."
                : "Genie needs an explicitly public development space.",
            },
      },
    };
  }

  async search(
    userId: string,
    input: AssistantKnowledgeSearchInput,
  ): Promise<AssistantKnowledgeSearchResult> {
    return tryCatch(
      async () => {
        const sourceTypes = new Set(input.sourceTypes ?? ["docs", "corpus"]);
        const warnings = [
          "Local documentation and corpus retrieval uses lexical matching, not model-generated semantic recall.",
        ];
        const hits: AssistantKnowledgeHit[] = [];
        if (sourceTypes.has("docs")) {
          if (await this.docsRetriever.isAvailable()) {
            hits.push(...(await this.docsRetriever.search(input.query, input.limit)));
          } else {
            warnings.push(
              "Documentation search is unavailable because the docs root was not found.",
            );
          }
        }
        if (sourceTypes.has("corpus")) {
          hits.push(...(await this.searchCorpus(input.query, input.topicTags ?? [])));
        }
        if (sourceTypes.has("document")) {
          hits.push(...(await this.searchPrivateDocuments(userId, input)));
        }
        if (sourceTypes.has("genie")) {
          warnings.push(
            "Genie is not exposed through general knowledge search or a caller-facing assistant tool.",
          );
        }
        const ranked = hits.sort((left, right) => right.score - left.score).slice(0, input.limit);
        return {
          hits: ranked,
          retrievalMode: "lexical" as const,
          answerable: ranked.length > 0,
          warnings,
        };
      },
      (error) =>
        error instanceof AppError
          ? error
          : AppError.internal(
              error instanceof Error ? error.message : "Knowledge search failed",
              "ASSISTANT_KNOWLEDGE_SEARCH_FAILED",
            ),
    );
  }

  async queryPublicGenie(input: PublicGenieQuery): Promise<Result<string>> {
    return tryCatch(
      () => this.genieClient.askPublicDataset(input.question),
      (error) =>
        error instanceof AppError
          ? error
          : AppError.internal(
              error instanceof Error ? error.message : "Genie query failed",
              "GENIE_QUERY_FAILED",
            ),
    );
  }

  async listCorpusWorks(
    userId: string,
    organizationId?: string,
    includeRemoved = false,
  ): Promise<Result<CorpusWork[]>> {
    const works = await this.store.listCorpusWorks();
    const scopedWorks = works.filter(
      (work) => !organizationId || work.organizationId === organizationId,
    );
    const accessByOrganization = new Map<string, { isMember: boolean; isCurator: boolean }>();
    await Promise.all(
      [...new Set(scopedWorks.map((work) => work.organizationId))].map(async (id) => {
        const role = await this.organizationRole(userId, id);
        accessByOrganization.set(id, {
          isMember: role !== null,
          isCurator: role === "owner" || role === "admin",
        });
      }),
    );
    return success(
      scopedWorks
        .filter((work) => {
          const access = accessByOrganization.get(work.organizationId);
          if (work.status === "removed") {
            return includeRemoved && access?.isCurator === true;
          }
          return this.isAdmittedSharedWork(work) || access?.isMember === true;
        })
        .map(publicCorpusWork),
    );
  }

  async getCorpusWork(userId: string, workId: string): Promise<Result<CorpusWork>> {
    const work = await this.store.getCorpusWork(workId);
    if (!work || work.status === "removed") {
      return failure(AppError.notFound("Corpus work not found"));
    }
    if (
      !this.isAdmittedSharedWork(work) &&
      !(await this.isOrganizationMember(userId, work.organizationId))
    ) {
      return failure(AppError.notFound("Corpus work not found"));
    }
    return success(publicCorpusWork(work));
  }

  async createCorpusWork(
    userId: string,
    input: CreateCorpusWorkInput,
  ): Promise<Result<CorpusWork>> {
    if (!(await this.isCurator(userId, input.organizationId))) {
      return failure(
        AppError.forbidden("Only an organization owner or admin can curate corpus works."),
      );
    }
    const now = new Date().toISOString();
    const work: StoredCorpusWork = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      title: input.title,
      authors: input.authors,
      year: input.year,
      doi: input.doi ?? null,
      sourceUrl: input.sourceUrl ?? null,
      topicTags: input.topicTags,
      fixture: false,
      status: "held",
      rights: {
        status: "pending",
        basis: input.rights?.basis ?? null,
        licenceId: input.rights?.licenceId ?? null,
        licenceUrl: input.rights?.licenceUrl ?? null,
        attribution: input.rights?.attribution ?? null,
        reviewedBy: null,
        reviewedAt: null,
        externalPublicStatus: "pending",
        externalPublicReviewedBy: null,
        externalPublicReviewedAt: null,
      },
      parse: this.emptyParse(),
      fileName: null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      removedAt: null,
      localFilePath: null,
      databricksFilePath: null,
    };
    await this.store.saveCorpusWork(work);
    return success(publicCorpusWork(work));
  }

  async attachCorpusFile(
    userId: string,
    workId: string,
    file: { fileName: string; localFilePath: string },
  ): Promise<Result<CorpusWork>> {
    const work = await this.store.getCorpusWork(workId);
    if (!work || work.status === "removed") {
      return failure(AppError.notFound("Corpus work not found"));
    }
    if (!(await this.isCurator(userId, work.organizationId))) {
      return failure(
        AppError.forbidden("Only an organization owner or admin can upload corpus files."),
      );
    }
    if (work.localFilePath && work.localFilePath !== file.localFilePath) {
      await rm(work.localFilePath, { force: true });
    }
    work.fileName = file.fileName;
    work.localFilePath = file.localFilePath;
    work.databricksFilePath = null;
    work.status = "uploaded";
    work.parse = this.emptyParse();
    work.updatedAt = new Date().toISOString();
    await this.store.saveCorpusWork(work);
    return success(publicCorpusWork(work));
  }

  async parseCorpusWork(userId: string, workId: string): Promise<Result<CorpusWork>> {
    const work = await this.store.getCorpusWork(workId);
    if (!work || work.status === "removed") {
      return failure(AppError.notFound("Corpus work not found"));
    }
    if (!(await this.isCurator(userId, work.organizationId))) {
      return failure(
        AppError.forbidden("Only an organization owner or admin can parse corpus works."),
      );
    }
    if (!work.localFilePath || !work.fileName) {
      return failure(AppError.badRequest("Upload a file before parsing.", "DOCUMENT_NOT_UPLOADED"));
    }
    work.status = "parsing";
    work.parse.status = "parsing";
    work.updatedAt = new Date().toISOString();
    await this.store.saveCorpusWork(work);
    try {
      const result = await this.documentParser.parse({
        recordId: work.id,
        ownerUserId: work.createdBy,
        fileName: work.fileName,
        localFilePath: work.localFilePath,
        scope: "corpus",
        existingDatabricksFilePath: work.databricksFilePath,
      });
      work.parse = result.parse;
      work.databricksFilePath = result.databricksFilePath;
      work.status = "review";
      work.updatedAt = new Date().toISOString();
      await this.store.saveCorpusWork(work);
      return success(publicCorpusWork(work));
    } catch (error) {
      const appError =
        error instanceof AppError ? error : AppError.internal("Document parse failed");
      work.status = "failed";
      work.parse = {
        ...work.parse,
        status: "failed",
        errorCode:
          appError.code === "DATABRICKS_NOT_CONFIGURED"
            ? "DATABRICKS_NOT_CONFIGURED"
            : appError.code === "DATABRICKS_AUTH_FAILED"
              ? "DATABRICKS_AUTH_FAILED"
              : "DOCUMENT_PARSE_FAILED",
        errorMessage: appError.message,
      };
      work.updatedAt = new Date().toISOString();
      await this.store.saveCorpusWork(work);
      return failure(appError);
    }
  }

  async reviewCorpusWork(
    userId: string,
    input: ReviewCorpusWorkInput,
  ): Promise<Result<CorpusWork>> {
    const work = await this.store.getCorpusWork(input.workId);
    if (!work || work.status === "removed") {
      return failure(AppError.notFound("Corpus work not found"));
    }
    if (!(await this.isCurator(userId, work.organizationId))) {
      return failure(
        AppError.forbidden("Only an organization owner or admin can review corpus works."),
      );
    }
    if (
      work.parse.status !== "review" &&
      work.parse.status !== "accepted" &&
      work.parse.status !== "rejected"
    ) {
      return failure(AppError.badRequest("The parse is not ready for review."));
    }
    const now = new Date().toISOString();
    work.parse.status = input.parseDecision;
    work.parse.reviewedBy = userId;
    work.parse.reviewedAt = now;
    work.parse.reviewNote = input.parseReviewNote ?? null;
    work.rights = {
      status: input.rightsDecision,
      basis: input.rights.basis,
      licenceId: input.rights.licenceId,
      licenceUrl: input.rights.licenceUrl,
      attribution: input.rights.attribution,
      reviewedBy: userId,
      reviewedAt: now,
      externalPublicStatus: input.externalPublicDecision,
      externalPublicReviewedBy: input.externalPublicDecision === "pending" ? null : userId,
      externalPublicReviewedAt: input.externalPublicDecision === "pending" ? null : now,
    };
    work.status =
      input.parseDecision === "rejected" || input.rightsDecision === "rejected"
        ? "rejected"
        : "review";
    work.updatedAt = now;
    await this.store.saveCorpusWork(work);
    return success(publicCorpusWork(work));
  }

  async admitCorpusWork(userId: string, workId: string): Promise<Result<CorpusWork>> {
    const work = await this.store.getCorpusWork(workId);
    if (!work || work.status === "removed") {
      return failure(AppError.notFound("Corpus work not found"));
    }
    if (!(await this.isCurator(userId, work.organizationId))) {
      return failure(
        AppError.forbidden("Only an organization owner or admin can admit corpus works."),
      );
    }
    if (
      work.parse.status !== "accepted" ||
      work.rights.status !== "approved" ||
      !work.rights.basis ||
      !work.rights.licenceId ||
      !work.rights.attribution
    ) {
      return failure(
        AppError.badRequest(
          "A corpus work needs an accepted parse and explicitly approved rights before admission.",
          "CORPUS_ADMISSION_BLOCKED",
        ),
      );
    }
    work.status = "active";
    work.updatedAt = new Date().toISOString();
    await this.store.saveCorpusWork(work);
    return success(publicCorpusWork(work));
  }

  async removeCorpusWork(userId: string, workId: string): Promise<Result<CorpusWork>> {
    const work = await this.store.getCorpusWork(workId);
    if (!work || work.status === "removed") {
      return failure(AppError.notFound("Corpus work not found"));
    }
    if (!(await this.isCurator(userId, work.organizationId))) {
      return failure(
        AppError.forbidden("Only an organization owner or admin can remove corpus works."),
      );
    }
    const now = new Date().toISOString();
    work.status = "removed";
    work.removedAt = now;
    work.updatedAt = now;
    await this.store.saveCorpusWork(work);
    return success(publicCorpusWork(work));
  }

  async listDocuments(
    userId: string,
    organizationId?: string,
  ): Promise<Result<AssistantPrivateDocument[]>> {
    const documents = await this.store.listDocuments(userId);
    return success(
      documents
        .filter((document) => !organizationId || document.organizationId === organizationId)
        .map(publicDocument),
    );
  }

  async getDocument(userId: string, documentId: string): Promise<Result<AssistantPrivateDocument>> {
    const document = await this.store.getDocument(documentId, userId);
    return document
      ? success(publicDocument(document))
      : failure(AppError.notFound("Private document not found"));
  }

  async registerDocumentUpload(
    userId: string,
    input: {
      id: string;
      organizationId: string;
      fileName: string;
      mediaType: string;
      byteSize: number;
      localFilePath: string;
    },
  ): Promise<Result<AssistantPrivateDocument>> {
    if (!(await this.isOrganizationMember(userId, input.organizationId))) {
      return failure(AppError.forbidden("The upload organization must include the current user."));
    }
    const now = new Date().toISOString();
    const document: StoredAssistantDocument = {
      id: input.id,
      organizationId: input.organizationId,
      ownerUserId: userId,
      fileName: input.fileName,
      mediaType: input.mediaType,
      byteSize: input.byteSize,
      parse: this.emptyParse(),
      createdAt: now,
      updatedAt: now,
      localFilePath: input.localFilePath,
      databricksFilePath: null,
    };
    await this.store.saveDocument(document);
    return success(publicDocument(document));
  }

  async parseDocument(
    userId: string,
    documentId: string,
  ): Promise<Result<AssistantPrivateDocument>> {
    const document = await this.store.getDocument(documentId, userId);
    if (!document) {
      return failure(AppError.notFound("Private document not found"));
    }
    document.parse.status = "parsing";
    document.updatedAt = new Date().toISOString();
    await this.store.saveDocument(document);
    try {
      const result = await this.documentParser.parse({
        recordId: document.id,
        ownerUserId: userId,
        fileName: document.fileName,
        localFilePath: document.localFilePath,
        scope: "private",
        existingDatabricksFilePath: document.databricksFilePath,
      });
      document.parse = result.parse;
      document.databricksFilePath = result.databricksFilePath;
      document.updatedAt = new Date().toISOString();
      await this.store.saveDocument(document);
      return success(publicDocument(document));
    } catch (error) {
      const appError =
        error instanceof AppError ? error : AppError.internal("Document parse failed");
      document.parse = {
        ...document.parse,
        status: "failed",
        errorCode:
          appError.code === "DATABRICKS_NOT_CONFIGURED"
            ? "DATABRICKS_NOT_CONFIGURED"
            : appError.code === "DATABRICKS_AUTH_FAILED"
              ? "DATABRICKS_AUTH_FAILED"
              : "DOCUMENT_PARSE_FAILED",
        errorMessage: appError.message,
      };
      document.updatedAt = new Date().toISOString();
      await this.store.saveDocument(document);
      return failure(appError);
    }
  }

  async deleteDocument(userId: string, documentId: string): Promise<Result<{ deleted: true }>> {
    const document = await this.store.getDocument(documentId, userId);
    if (!document) {
      return failure(AppError.notFound("Private document not found"));
    }
    await this.store.removeDocument(documentId, userId);
    await rm(document.localFilePath, { force: true });
    return success({ deleted: true });
  }

  async listExternallyPublicCorpusHits(
    query: string,
    limit: number,
  ): Promise<AssistantKnowledgeHit[]> {
    const hits = await this.searchCorpus(query, []);
    const allowed = new Set(
      (await this.store.listCorpusWorks())
        .filter(
          (work) =>
            work.status === "active" &&
            work.rights.status === "approved" &&
            work.rights.externalPublicStatus === "approved",
        )
        .map((work) => work.id),
    );
    return hits.filter((hit) => allowed.has(hit.citation.sourceId)).slice(0, limit);
  }

  private async searchCorpus(query: string, topicTags: string[]): Promise<AssistantKnowledgeHit[]> {
    const queryTerms = this.queryTerms(query);
    if (queryTerms.length === 0) {
      return [];
    }
    return (await this.store.listCorpusWorks())
      .filter((work) => this.isAdmittedSharedWork(work))
      .filter(
        (work) => topicTags.length === 0 || topicTags.some((tag) => work.topicTags.includes(tag)),
      )
      .flatMap((work) =>
        work.parse.elements.map((element): AssistantKnowledgeHit | null => {
          const haystack =
            `${work.title} ${work.topicTags.join(" ")} ${element.content}`.toLocaleLowerCase();
          const score = queryTerms.reduce(
            (total, term) => total + (haystack.includes(term) ? 1 : 0),
            0,
          );
          if (score === 0) {
            return null;
          }
          return {
            citation: {
              sourceType: "corpus",
              sourceId: work.id,
              title: work.title,
              year: work.year,
              page: element.page,
              route: `/platform/assistant/corpus/${work.id}`,
              sourceUrl: work.sourceUrl,
              licenceId: work.rights.licenceId,
            },
            excerpt: element.content.slice(0, 700),
            score,
          };
        }),
      )
      .filter((hit): hit is AssistantKnowledgeHit => hit !== null)
      .sort((left, right) => right.score - left.score);
  }

  private async searchPrivateDocuments(
    userId: string,
    input: AssistantKnowledgeSearchInput,
  ): Promise<AssistantKnowledgeHit[]> {
    const queryTerms = this.queryTerms(input.query);
    const documents = await this.store.listDocuments(userId);
    return documents
      .filter(
        (document) => !input.organizationId || document.organizationId === input.organizationId,
      )
      .filter(
        (document) => document.parse.status === "accepted" || document.parse.status === "review",
      )
      .flatMap((document) =>
        document.parse.elements.map((element): AssistantKnowledgeHit | null => {
          const haystack = `${document.fileName} ${element.content}`.toLocaleLowerCase();
          const score = queryTerms.reduce(
            (total, term) => total + (haystack.includes(term) ? 1 : 0),
            0,
          );
          return score === 0
            ? null
            : {
                citation: {
                  sourceType: "document",
                  sourceId: document.id,
                  title: document.fileName,
                  year: null,
                  page: element.page,
                  route: null,
                  sourceUrl: null,
                  licenceId: null,
                },
                excerpt: element.content.slice(0, 700),
                score,
              };
        }),
      )
      .filter((hit): hit is AssistantKnowledgeHit => hit !== null);
  }

  private queryTerms(query: string): string[] {
    return [
      ...new Set(
        query
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .split(/\s+/)
          .filter((term) => term.length > 1),
      ),
    ];
  }

  private emptyParse(): StoredCorpusWork["parse"] {
    return {
      provider: "databricks-ai-parse-document",
      status: "not-started",
      pages: 0,
      elements: [],
      averageConfidence: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  private async isOrganizationMember(userId: string, organizationId: string): Promise<boolean> {
    return (await this.organizationRole(userId, organizationId)) !== null;
  }

  private isAdmittedSharedWork(work: StoredCorpusWork): boolean {
    return (
      work.status === "active" &&
      work.rights.status === "approved" &&
      work.parse.status === "accepted" &&
      work.rights.basis !== null &&
      work.rights.licenceId !== null &&
      work.rights.attribution !== null
    );
  }

  private async organizationRole(userId: string, organizationId: string): Promise<string | null> {
    const rows = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
        ),
      )
      .limit(1);
    return rows[0]?.role ?? null;
  }

  private async isCurator(userId: string, organizationId: string): Promise<boolean> {
    const role = await this.organizationRole(userId, organizationId);
    return role === "owner" || role === "admin";
  }

  private async isCuratorOfAnyOrganization(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    return rows.some(({ role }) => role === "owner" || role === "admin");
  }
}
