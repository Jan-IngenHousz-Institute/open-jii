import { ConfigService } from "@nestjs/config";
import { tmpdir } from "node:os";

import type { DatabricksConfigService } from "../../common/modules/databricks/services/config/config.service";
import type { DatabricksFilesService } from "../../common/modules/databricks/services/files/files.service";
import type { DatabricksSqlService } from "../../common/modules/databricks/services/sql/sql.service";
import { success } from "../../common/utils/fp-utils";
import { DatabricksDocumentParser } from "./databricks-document-parser";

describe("DatabricksDocumentParser", () => {
  it("uses ai_parse_document 2.0 and maps element bounding boxes to one-based page citations", async () => {
    let statement = "";
    const parser = new DatabricksDocumentParser(
      new ConfigService({ ASSISTANT_DATABRICKS_VOLUME: "/Volumes/dev/centrum/assistant" }),
      { getCentrumSchemaName: () => "centrum" } as DatabricksConfigService,
      {} as DatabricksFilesService,
      {
        executeSqlQuery: (_schema: string, sql: string) => {
          statement = sql;
          return Promise.resolve(
            success({
              columns: [{ name: "parsed", type_name: "STRING", type_text: "STRING", position: 0 }],
              rows: [
                [
                  JSON.stringify({
                    document: {
                      pages: [{ id: 0 }, { id: 1 }],
                      elements: [
                        {
                          type: "table",
                          content: "<table><tr><td>chlorophyll</td></tr></table>",
                          confidence: 0.9,
                          bbox: [{ page_id: 1 }],
                        },
                      ],
                    },
                    error_status: [],
                  }),
                ],
              ],
              totalRows: 1,
              truncated: false,
            }),
          );
        },
      } as DatabricksSqlService,
    );

    const result = await parser.parse({
      recordId: "00000000-0000-4000-8000-000000000401",
      ownerUserId: "00000000-0000-4000-8000-000000000402",
      fileName: "paper.pdf",
      localFilePath: "/not/read/when/already-uploaded",
      scope: "corpus",
      existingDatabricksFilePath: "/Volumes/dev/centrum/assistant/corpus/paper.pdf",
    });

    expect(statement).toContain("ai_parse_document(content, map('version', '2.0'))");
    expect(statement).toContain("format => 'binaryFile'");
    expect(result.parse).toMatchObject({
      provider: "databricks-ai-parse-document",
      status: "review",
      pages: 2,
      elements: [{ kind: "table", page: 2, confidence: 0.9 }],
    });
  });

  it("fails visibly when no development volume is configured", async () => {
    const parser = new DatabricksDocumentParser(
      { get: () => undefined } as unknown as ConfigService,
      {} as DatabricksConfigService,
      {} as DatabricksFilesService,
      {} as DatabricksSqlService,
    );

    await expect(
      parser.parse({
        recordId: "00000000-0000-4000-8000-000000000401",
        ownerUserId: "00000000-0000-4000-8000-000000000402",
        fileName: "paper.pdf",
        localFilePath: "/paper.pdf",
        scope: "private",
        existingDatabricksFilePath: null,
      }),
    ).rejects.toMatchObject({ code: "DATABRICKS_NOT_CONFIGURED" });
  });

  it("turns a missing local upload into a handled parse failure", async () => {
    const upload = vi.fn();
    const parser = new DatabricksDocumentParser(
      new ConfigService({ ASSISTANT_DATABRICKS_VOLUME: "/Volumes/dev/centrum/assistant" }),
      {} as DatabricksConfigService,
      { upload } as unknown as DatabricksFilesService,
      {} as DatabricksSqlService,
    );

    await expect(
      parser.parse({
        recordId: "00000000-0000-4000-8000-000000000411",
        ownerUserId: "00000000-0000-4000-8000-000000000412",
        fileName: "missing.pdf",
        localFilePath: `${tmpdir()}/openjii-file-that-does-not-exist.pdf`,
        scope: "private",
        existingDatabricksFilePath: null,
      }),
    ).rejects.toMatchObject({
      code: "DOCUMENT_PARSE_FAILED",
      message: "The uploaded document is missing or unreadable.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("handles a read error emitted after the local path opens", async () => {
    const upload = vi.fn(async (_path: string, body: NodeJS.ReadableStream) => {
      for await (const _chunk of body) {
        // Consume the stream so the directory read emits EISDIR.
      }
      return success({ filePath: "/unused" });
    });
    const parser = new DatabricksDocumentParser(
      new ConfigService({ ASSISTANT_DATABRICKS_VOLUME: "/Volumes/dev/centrum/assistant" }),
      {} as DatabricksConfigService,
      { upload } as unknown as DatabricksFilesService,
      {} as DatabricksSqlService,
    );

    await expect(
      parser.parse({
        recordId: "00000000-0000-4000-8000-000000000421",
        ownerUserId: "00000000-0000-4000-8000-000000000422",
        fileName: "unreadable.pdf",
        localFilePath: tmpdir(),
        scope: "private",
        existingDatabricksFilePath: null,
      }),
    ).rejects.toMatchObject({
      code: "DOCUMENT_PARSE_FAILED",
      message: "The uploaded document is missing or unreadable.",
    });
  });
});
