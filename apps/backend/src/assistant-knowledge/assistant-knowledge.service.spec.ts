import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  zCorpusWork,
  zAssistantKnowledgeSearchResponse,
} from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";
import type { DatabaseInstance } from "@repo/database";

import { AssistantKnowledgeService } from "./assistant-knowledge.service";
import { AssistantKnowledgeStore } from "./infrastructure/assistant-knowledge.store";
import { AUTHORED_CORPUS_FIXTURE } from "./infrastructure/authored-corpus.fixture";
import type { DatabricksDocumentParser } from "./infrastructure/databricks-document-parser";
import type { DatabricksGenieClient } from "./infrastructure/databricks-genie.client";
import type { DocsRetriever } from "./infrastructure/docs-retriever";

function curatorDatabase(): DatabaseInstance {
  const rows = [{ role: "admin" }];
  const query = {
    limit: () => Promise.resolve(rows),
    then: (resolve: (value: typeof rows) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return {
    select: () => ({ from: () => ({ where: () => query }) }),
  } as unknown as DatabaseInstance;
}

function databaseWithRoles(...roles: (string | null)[]): DatabaseInstance {
  let queryIndex = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => {
          const role = roles[queryIndex++] ?? null;
          const rows = role ? [{ role }] : [];
          return {
            limit: () => Promise.resolve(rows),
            then: (resolve: (value: typeof rows) => unknown) => Promise.resolve(rows).then(resolve),
          };
        },
      }),
    }),
  } as unknown as DatabaseInstance;
}

describe("AssistantKnowledgeService", () => {
  let dataDirectory: string;
  let store: AssistantKnowledgeStore;
  let service: AssistantKnowledgeService;

  beforeEach(async () => {
    dataDirectory = await mkdtemp(path.join(tmpdir(), "openjii-assistant-knowledge-"));
    const config = new ConfigService({ ASSISTANT_KNOWLEDGE_DATA_DIR: dataDirectory });
    store = new AssistantKnowledgeStore(config);
    const docs = {
      isAvailable: () => Promise.resolve(true),
      search: () => Promise.resolve([]),
    } as unknown as DocsRetriever;
    const parser = { isConfigured: () => false } as unknown as DatabricksDocumentParser;
    const genie = { isConfigured: () => false } as unknown as DatabricksGenieClient;
    service = new AssistantKnowledgeService(curatorDatabase(), config, store, docs, parser, genie);
  });

  afterEach(async () => {
    await rm(dataDirectory, { recursive: true, force: true });
  });

  it.each([
    { sourceUrl: "javascript:alert(1)", expected: null },
    { sourceUrl: "data:text/html,<script>alert(1)</script>", expected: null },
    { sourceUrl: "ftp://papers.example/study.pdf", expected: null },
    { sourceUrl: "https://papers.example/study.pdf", expected: "https://papers.example/study.pdf" },
    { sourceUrl: "http://papers.example/study.pdf", expected: "http://papers.example/study.pdf" },
    { sourceUrl: null, expected: null },
  ])(
    "normalizes legacy $sourceUrl for authenticated list, detail and search",
    async ({ sourceUrl, expected }) => {
      const work = { ...structuredClone(AUTHORED_CORPUS_FIXTURE), sourceUrl };
      await writeFile(
        path.join(dataDirectory, "state.json"),
        JSON.stringify({ version: 1, corpusWorks: [work], documents: [] }),
      );
      const userId = "00000000-0000-4000-8000-000000000201";
      const listed = await service.listCorpusWorks(userId);
      if (listed.isFailure()) throw listed.error;
      expect(
        zCorpusWork
          .array()
          .parse(listed.value)
          .map((entry) => entry.sourceUrl),
      ).toEqual([expected]);
      expect(listed.value[0]).not.toHaveProperty("localFilePath");

      const detail = await service.getCorpusWork(userId, work.id);
      if (detail.isFailure()) throw detail.error;
      expect(zCorpusWork.parse(detail.value).sourceUrl).toBe(expected);
      expect(detail.value).not.toHaveProperty("databricksFilePath");

      const search = await service.search(userId, {
        query: "photosynthetic induction",
        sourceTypes: ["corpus"],
        limit: 5,
      });
      if (search.isFailure()) throw search.error;
      const hits = zAssistantKnowledgeSearchResponse.parse(search.value).hits;
      expect(hits.length).toBeGreaterThan(0);
      for (const hit of hits) {
        expect(hit.citation.sourceUrl).toBe(expected);
        expect(hit.citation.route).toBe(`/platform/assistant/corpus/${work.id}`);
      }
      expect((await store.getCorpusWork(work.id))?.sourceUrl).toBe(expected);
    },
  );

  it("does not expose platform-approved corpus material through the public tool by default", async () => {
    const hits = await service.listExternallyPublicCorpusHits("photosynthetic induction", 10);

    expect(hits).toEqual([]);
  });

  it("refuses corpus admission until rights and the parse are explicitly accepted", async () => {
    const created = await service.createCorpusWork("00000000-0000-4000-8000-000000000201", {
      organizationId: "00000000-0000-4000-8000-000000000202",
      title: "Test work",
      authors: ["Researcher"],
      year: 2026,
      topicTags: [],
    });
    expect(created.isSuccess()).toBe(true);
    if (created.isFailure()) return;

    const rejected = await service.admitCorpusWork(
      "00000000-0000-4000-8000-000000000201",
      created.value.id,
    );

    expect(rejected.isFailure()).toBe(true);
    if (rejected.isFailure()) {
      expect(rejected.error.code).toBe("CORPUS_ADMISSION_BLOCKED");
    }
  });

  it("returns page citations for admitted works and stops returning them immediately after removal", async () => {
    const curatorId = "00000000-0000-4000-8000-000000000211";
    const created = await service.createCorpusWork(curatorId, {
      organizationId: "00000000-0000-4000-8000-000000000212",
      title: "Gas exchange methods",
      authors: ["Researcher"],
      year: 2026,
      topicTags: ["gas exchange"],
    });
    if (created.isFailure()) throw created.error;
    const stored = await store.getCorpusWork(created.value.id);
    if (!stored) throw new Error("Expected stored corpus work");
    stored.parse = {
      provider: "databricks-ai-parse-document",
      status: "accepted",
      pages: 4,
      elements: [
        {
          kind: "text",
          page: 4,
          content: "Stabilize carbon dioxide before measuring stomatal conductance.",
          confidence: 0.98,
        },
      ],
      averageConfidence: 0.98,
      reviewedBy: curatorId,
      reviewedAt: "2026-09-21T00:00:00.000Z",
      reviewNote: null,
      errorCode: null,
      errorMessage: null,
    };
    stored.rights = {
      status: "approved",
      basis: "open-access",
      licenceId: "CC-BY-4.0",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Researcher (2026)",
      reviewedBy: curatorId,
      reviewedAt: "2026-09-21T00:00:00.000Z",
      externalPublicStatus: "pending",
      externalPublicReviewedBy: null,
      externalPublicReviewedAt: null,
    };
    await store.saveCorpusWork(stored);
    const admitted = await service.admitCorpusWork(curatorId, stored.id);
    expect(admitted.isSuccess()).toBe(true);

    const beforeRemoval = await service.search(curatorId, {
      query: "conductance",
      sourceTypes: ["corpus"],
      limit: 5,
    });
    if (beforeRemoval.isFailure()) throw beforeRemoval.error;
    expect(beforeRemoval.value.hits[0]?.citation).toMatchObject({
      sourceId: stored.id,
      page: 4,
      year: 2026,
      licenceId: "CC-BY-4.0",
    });

    await service.removeCorpusWork(curatorId, stored.id);
    const afterRemoval = await service.search(curatorId, {
      query: "conductance",
      sourceTypes: ["corpus"],
      limit: 5,
    });
    if (afterRemoval.isFailure()) throw afterRemoval.error;
    expect(afterRemoval.value.hits).toEqual([]);
  });

  it("looks up private documents by both id and creator", async () => {
    await store.saveDocument({
      id: "00000000-0000-4000-8000-000000000301",
      organizationId: "00000000-0000-4000-8000-000000000302",
      ownerUserId: "00000000-0000-4000-8000-000000000303",
      fileName: "private.pdf",
      mediaType: "application/pdf",
      byteSize: 12,
      parse: {
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
      },
      createdAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
      localFilePath: path.join(dataDirectory, "private.pdf"),
      databricksFilePath: null,
    });

    const result = await service.getDocument(
      "00000000-0000-4000-8000-000000000304",
      "00000000-0000-4000-8000-000000000301",
    );

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.statusCode).toBe(404);
    }
  });

  it("hides another organization's unadmitted parse text while retaining admitted shared works", async () => {
    const curatorId = "00000000-0000-4000-8000-000000000311";
    const organizationId = "00000000-0000-4000-8000-000000000312";
    const held = await service.createCorpusWork(curatorId, {
      organizationId,
      title: "Held publisher upload",
      authors: ["Publisher"],
      year: 2026,
      topicTags: [],
    });
    const admitted = await service.createCorpusWork(curatorId, {
      organizationId,
      title: "Admitted shared paper",
      authors: ["Author"],
      year: 2026,
      topicTags: [],
    });
    const incompleteAdmission = await service.createCorpusWork(curatorId, {
      organizationId,
      title: "Incomplete rights record",
      authors: ["Publisher"],
      year: 2026,
      topicTags: [],
    });
    if (held.isFailure()) throw held.error;
    if (admitted.isFailure()) throw admitted.error;
    if (incompleteAdmission.isFailure()) throw incompleteAdmission.error;

    const heldStored = await store.getCorpusWork(held.value.id);
    const admittedStored = await store.getCorpusWork(admitted.value.id);
    const incompleteStored = await store.getCorpusWork(incompleteAdmission.value.id);
    if (!heldStored || !admittedStored || !incompleteStored) {
      throw new Error("Expected stored corpus works");
    }
    heldStored.parse = {
      ...heldStored.parse,
      status: "review",
      pages: 1,
      elements: [
        {
          kind: "text",
          page: 1,
          content: "UNAPPROVED-PUBLISHER-TEXT",
          confidence: 0.9,
        },
      ],
    };
    admittedStored.status = "active";
    admittedStored.parse = {
      ...admittedStored.parse,
      status: "accepted",
      pages: 1,
      elements: [
        {
          kind: "text",
          page: 1,
          content: "Approved shared text",
          confidence: 0.9,
        },
      ],
    };
    admittedStored.rights = {
      ...admittedStored.rights,
      status: "approved",
      basis: "open-access",
      licenceId: "CC-BY-4.0",
      attribution: "Author (2026)",
    };
    incompleteStored.status = "active";
    incompleteStored.parse = {
      ...incompleteStored.parse,
      status: "accepted",
      pages: 1,
      elements: [
        {
          kind: "text",
          page: 1,
          content: "INCOMPLETE-RIGHTS-TEXT",
          confidence: 0.9,
        },
      ],
    };
    incompleteStored.rights.status = "approved";
    await store.saveCorpusWork(heldStored);
    await store.saveCorpusWork(admittedStored);
    await store.saveCorpusWork(incompleteStored);

    const unrelatedService = new AssistantKnowledgeService(
      databaseWithRoles(null),
      new ConfigService({ ASSISTANT_KNOWLEDGE_DATA_DIR: dataDirectory }),
      store,
      {
        isAvailable: () => Promise.resolve(true),
        search: () => Promise.resolve([]),
      } as unknown as DocsRetriever,
      { isConfigured: () => false } as unknown as DatabricksDocumentParser,
      { isConfigured: () => false } as unknown as DatabricksGenieClient,
    );
    const listed = await unrelatedService.listCorpusWorks("00000000-0000-4000-8000-000000000313");

    if (listed.isFailure()) throw listed.error;
    expect(listed.value.map((work) => work.id)).toContain(admittedStored.id);
    expect(listed.value.map((work) => work.id)).not.toContain(heldStored.id);
    expect(listed.value.map((work) => work.id)).not.toContain(incompleteStored.id);
    expect(JSON.stringify(listed.value)).not.toContain("UNAPPROVED-PUBLISHER-TEXT");
    expect(JSON.stringify(listed.value)).not.toContain("INCOMPLETE-RIGHTS-TEXT");

    const incompleteReadService = new AssistantKnowledgeService(
      databaseWithRoles(null),
      new ConfigService({ ASSISTANT_KNOWLEDGE_DATA_DIR: dataDirectory }),
      store,
      {} as DocsRetriever,
      { isConfigured: () => false } as unknown as DatabricksDocumentParser,
      { isConfigured: () => false } as unknown as DatabricksGenieClient,
    );
    const incompleteRead = await incompleteReadService.getCorpusWork(
      "00000000-0000-4000-8000-000000000313",
      incompleteStored.id,
    );
    expect(incompleteRead.isFailure()).toBe(true);

    const searched = await unrelatedService.search("00000000-0000-4000-8000-000000000313", {
      query: "INCOMPLETE RIGHTS TEXT",
      sourceTypes: ["corpus"],
      limit: 5,
    });
    if (searched.isFailure()) throw searched.error;
    expect(searched.value.hits.map((hit) => hit.citation.sourceId)).not.toContain(
      incompleteStored.id,
    );
    expect(JSON.stringify(searched.value.hits)).not.toContain("INCOMPLETE-RIGHTS-TEXT");
  });

  it("returns not found for a cross-organization read of an unadmitted work", async () => {
    const created = await service.createCorpusWork("00000000-0000-4000-8000-000000000321", {
      organizationId: "00000000-0000-4000-8000-000000000322",
      title: "Held work",
      authors: ["Publisher"],
      year: 2026,
      topicTags: [],
    });
    if (created.isFailure()) throw created.error;
    const unrelatedService = new AssistantKnowledgeService(
      databaseWithRoles(null),
      new ConfigService({ ASSISTANT_KNOWLEDGE_DATA_DIR: dataDirectory }),
      store,
      {} as DocsRetriever,
      { isConfigured: () => false } as unknown as DatabricksDocumentParser,
      { isConfigured: () => false } as unknown as DatabricksGenieClient,
    );

    const result = await unrelatedService.getCorpusWork(
      "00000000-0000-4000-8000-000000000323",
      created.value.id,
    );

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.statusCode).toBe(404);
    }
  });

  it("allows an organization member to read its unadmitted work", async () => {
    const created = await service.createCorpusWork("00000000-0000-4000-8000-000000000331", {
      organizationId: "00000000-0000-4000-8000-000000000332",
      title: "Member-visible held work",
      authors: ["Publisher"],
      year: 2026,
      topicTags: [],
    });
    if (created.isFailure()) throw created.error;
    const memberService = new AssistantKnowledgeService(
      databaseWithRoles("member"),
      new ConfigService({ ASSISTANT_KNOWLEDGE_DATA_DIR: dataDirectory }),
      store,
      {} as DocsRetriever,
      { isConfigured: () => false } as unknown as DatabricksDocumentParser,
      { isConfigured: () => false } as unknown as DatabricksGenieClient,
    );

    const result = await memberService.getCorpusWork(
      "00000000-0000-4000-8000-000000000333",
      created.value.id,
    );

    expect(result.isSuccess()).toBe(true);
  });

  it("reports configured Genie as unavailable until a caller-facing tool is wired", async () => {
    const configuredGenieService = new AssistantKnowledgeService(
      curatorDatabase(),
      new ConfigService({ ASSISTANT_KNOWLEDGE_DATA_DIR: dataDirectory }),
      store,
      {
        isAvailable: () => Promise.resolve(true),
        search: () => Promise.resolve([]),
      } as unknown as DocsRetriever,
      { isConfigured: () => false } as unknown as DatabricksDocumentParser,
      { isConfigured: () => true } as unknown as DatabricksGenieClient,
    );

    const capabilities = await configuredGenieService.getCapabilities(
      "00000000-0000-4000-8000-000000000341",
    );

    expect(capabilities.canUseGenie).toBe(false);
    expect(capabilities.providers.genie).toEqual({
      state: "unavailable",
      code: "GENIE_TOOL_UNAVAILABLE",
      message: "Genie is configured, but no caller-facing assistant tool is wired.",
    });
  });
});
