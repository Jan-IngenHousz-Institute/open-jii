import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { open } from "node:fs/promises";
import path from "node:path";

import type {
  AssistantParse,
  AssistantParseElement,
} from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";

import { DatabricksConfigService } from "../../common/modules/databricks/services/config/config.service";
import { DatabricksFilesService } from "../../common/modules/databricks/services/files/files.service";
import { DatabricksSqlService } from "../../common/modules/databricks/services/sql/sql.service";
import { AppError } from "../../common/utils/fp-utils";

interface DatabricksParsedDocument {
  document?: {
    pages?: { id?: number }[];
    elements?: {
      type?: string;
      content?: string | null;
      description?: string | null;
      confidence?: number | null;
      bbox?: { page_id?: number }[];
    }[];
  };
  error_status?: { error_message?: string; page_id?: number }[];
}

export interface ParseDocumentInput {
  recordId: string;
  ownerUserId: string;
  fileName: string;
  localFilePath: string;
  scope: "corpus" | "private";
  existingDatabricksFilePath: string | null;
}

export interface ParseDocumentResult {
  parse: AssistantParse;
  databricksFilePath: string;
}

@Injectable()
export class DatabricksDocumentParser {
  private readonly volumeRoot: string | null;

  constructor(
    configService: ConfigService,
    private readonly databricksConfig: DatabricksConfigService,
    private readonly filesService: DatabricksFilesService,
    private readonly sqlService: DatabricksSqlService,
  ) {
    const configured = configService
      .get<string>("ASSISTANT_DATABRICKS_VOLUME")
      ?.replace(/\/$/u, "");
    this.volumeRoot =
      configured && /^\/Volumes\/[^/]+\/[^/]+\/[^/]+$/u.test(configured) ? configured : null;
  }

  isConfigured(): boolean {
    return this.volumeRoot !== null;
  }

  async parse(input: ParseDocumentInput): Promise<ParseDocumentResult> {
    if (!this.volumeRoot) {
      throw AppError.internal(
        "Document Intelligence is not configured. Set ASSISTANT_DATABRICKS_VOLUME to an existing dev Unity Catalog volume path.",
        "DATABRICKS_NOT_CONFIGURED",
      );
    }
    const safeFileName = path.basename(input.fileName).replace(/[^A-Za-z0-9._-]/gu, "_");
    const databricksFilePath =
      input.existingDatabricksFilePath ??
      `${this.volumeRoot}/${input.scope}/${input.ownerUserId}/${input.recordId}/${safeFileName}`;

    if (!input.existingDatabricksFilePath) {
      const handle = await open(input.localFilePath, "r").catch(() => {
        throw AppError.internal(
          "The uploaded document is missing or unreadable.",
          "DOCUMENT_PARSE_FAILED",
        );
      });
      const stream = handle.createReadStream({ autoClose: false });
      const streamFailure = new Promise<never>((_resolve, reject) => {
        stream.once("error", reject);
      });
      const upload = await (async () => {
        try {
          return await Promise.race([
            this.filesService.upload(databricksFilePath, stream),
            streamFailure,
          ]);
        } catch {
          throw AppError.internal(
            "The uploaded document is missing or unreadable.",
            "DOCUMENT_PARSE_FAILED",
          );
        } finally {
          stream.destroy();
          await handle.close().catch(() => undefined);
        }
      })();
      if (upload.isFailure()) {
        throw AppError.internal(upload.error.message, "DOCUMENT_PARSE_FAILED");
      }
    }

    const escapedPath = databricksFilePath.replace(/'/gu, "''");
    const statement = `SELECT to_json(ai_parse_document(content, map('version', '2.0'))) AS parsed FROM READ_FILES('${escapedPath}', format => 'binaryFile') LIMIT 1`;
    const result = await this.sqlService.executeSqlQuery(
      this.databricksConfig.getCentrumSchemaName(),
      statement,
    );
    if (result.isFailure()) {
      throw AppError.internal(result.error.message, "DOCUMENT_PARSE_FAILED");
    }
    const raw = result.value.rows[0]?.[0];
    if (!raw) {
      throw AppError.internal(
        "Databricks returned no parsed document output.",
        "DOCUMENT_PARSE_FAILED",
      );
    }

    let parsed: DatabricksParsedDocument;
    try {
      parsed = JSON.parse(raw) as DatabricksParsedDocument;
    } catch {
      throw AppError.internal(
        "Databricks returned malformed document parser output.",
        "DOCUMENT_PARSE_FAILED",
      );
    }

    const elements = (parsed.document?.elements ?? [])
      .map((element): AssistantParseElement | null => {
        const content = element.content ?? element.description ?? "";
        if (!content.trim()) {
          return null;
        }
        const sourceType = element.type ?? "other";
        const kind: AssistantParseElement["kind"] =
          sourceType === "text"
            ? "text"
            : sourceType === "table"
              ? "table"
              : sourceType === "figure"
                ? "figure"
                : sourceType === "title" || sourceType === "section_header"
                  ? "heading"
                  : "other";
        return {
          kind,
          page: Math.max(1, (element.bbox?.[0]?.page_id ?? 0) + 1),
          content,
          confidence:
            typeof element.confidence === "number"
              ? Math.max(0, Math.min(1, element.confidence))
              : null,
        };
      })
      .filter((element): element is AssistantParseElement => element !== null);
    const confidences = elements
      .map((element) => element.confidence)
      .filter((confidence): confidence is number => confidence !== null);
    const parserErrors = parsed.error_status ?? [];

    return {
      databricksFilePath,
      parse: {
        provider: "databricks-ai-parse-document",
        status: "review",
        pages:
          parsed.document?.pages?.length ?? Math.max(0, ...elements.map((element) => element.page)),
        elements,
        averageConfidence:
          confidences.length > 0
            ? confidences.reduce((total, confidence) => total + confidence, 0) / confidences.length
            : null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        errorCode: parserErrors.length > 0 ? "DOCUMENT_PARSE_FAILED" : null,
        errorMessage:
          parserErrors.length > 0
            ? parserErrors
                .map((error) =>
                  error.page_id === undefined
                    ? (error.error_message ?? "Unknown page error")
                    : `Page ${error.page_id + 1}: ${error.error_message ?? "Unknown parse error"}`,
                )
                .join("; ")
            : null,
      },
    };
  }
}
