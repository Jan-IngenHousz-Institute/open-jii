import { ConfigService } from "@nestjs/config";
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import { zAssistantDraftPayload } from "@repo/api/domains/assistant/assistant.schema";
import type { AssistantDraft, AssistantSource } from "@repo/api/domains/assistant/assistant.schema";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import { AssistantService } from "./assistant.service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const DRAFT_ID = "00000000-0000-4000-8000-000000000002";
const CREATED_ID = "00000000-0000-4000-8000-000000000003";
const PROTOCOL_ID = "00000000-0000-4000-8000-000000000004";
const MACRO_ID = "00000000-0000-4000-8000-000000000005";
const ORG_ID = "00000000-0000-4000-8000-000000000006";
const description =
  "Compare sun and shade readings at paired sampling positions, recording the sample ID and treatment before each measurement.";
const cells = [
  { id: "instructions", type: "markdown", content: description },
  {
    id: "sample",
    type: "question",
    name: "Sample ID",
    question: { kind: "open_ended", text: "Sample ID", required: true },
  },
  { id: "light", type: "protocol", payload: { protocolId: PROTOCOL_ID, version: 1 } },
  { id: "summary", type: "macro", payload: { macroId: MACRO_ID, language: "python" } },
];

function harness(rawPayload: unknown, source: AssistantSource | null = null) {
  const payload = zAssistantDraftPayload.parse(rawPayload);
  const draft: AssistantDraft = {
    id: DRAFT_ID,
    threadId: DRAFT_ID,
    messageId: null,
    kind: payload.kind,
    status: "confirming",
    payload,
    source,
    createdEntity: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
  const repository = {
    claimDraft: vi.fn().mockResolvedValue(draft),
    getDraft: vi.fn().mockResolvedValue({ ...draft, status: "pending" }),
    updateDraft: vi.fn().mockResolvedValue({ ...draft, status: "pending" }),
    recordDraftCreated: vi.fn().mockResolvedValue(draft),
    finishDraft: vi.fn().mockResolvedValue({ ...draft, status: "confirmed" }),
    releaseDraftClaim: vi.fn(),
    recordUsage: vi.fn(),
  };
  const authorization = {
    can: vi.fn().mockResolvedValue({ allow: true }),
    isOrgMember: vi.fn().mockResolvedValue(true),
  };
  const create = {
    execute: vi.fn().mockResolvedValue(success({ id: CREATED_ID, name: payload.value.name })),
  };
  const attach = {
    execute: vi
      .fn()
      .mockResolvedValue(
        success({ workbookId: PROTOCOL_ID, workbookVersionId: MACRO_ID, version: 1 }),
      ),
  };
  const service = new AssistantService(
    new ConfigService({ assistant: { enabled: true } }),
    fromPartial({}),
    fromPartial(authorization),
    fromPartial(repository),
    fromPartial({}),
    fromPartial({}),
    fromPartial(create),
    fromPartial(create),
    fromPartial(create),
    fromPartial(create),
    fromPartial(create),
    fromPartial(attach),
  );
  return { service, repository, authorization, create, draft, attach };
}

describe("assistant content confirmation", () => {
  it.each([
    {
      kind: "protocol",
      value: {
        name: "Ambient PAR",
        description,
        family: "multispeq",
        code: [{ environmental: [["light_intensity"]] }],
      },
      invalid: { code: [] },
    },
    {
      kind: "experiment",
      value: { name: "Paired trial", description },
      invalid: { description: "bad" },
    },
    {
      kind: "workbook",
      value: { name: "Sun and shade", description, cells },
      invalid: {
        cells: Array.from({ length: 31 }, (_, index) => ({
          id: String(index),
          type: "markdown",
          content: "Measure",
        })),
      },
    },
    {
      kind: "macro",
      value: {
        name: "Summary",
        description,
        language: "python",
        code: "return {}",
        codeEncoding: "utf8",
      },
      invalid: { language: "javascript" },
    },
  ])("keeps new $kind validation when editing a stored draft", async ({ kind, value, invalid }) => {
    const { service, repository } = harness({ kind, value });
    await expect(
      service.updateDraft({ id: USER_ID }, DRAFT_ID, { kind, value: { ...value, ...invalid } }),
    ).rejects.toThrow();
    expect(repository.updateDraft).not.toHaveBeenCalled();
    await service.updateDraft({ id: USER_ID }, DRAFT_ID, {
      kind,
      value: { ...value, name: "Revised draft" },
    });
    expect(repository.getDraft).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    expect(repository.updateDraft).toHaveBeenCalledOnce();
  });

  it("preserves legacy editing when the stored draft does not satisfy new authoring rules", async () => {
    const value = { name: "Legacy", language: "javascript", code: "cmV0dXJuIHt9" };
    const { service, repository } = harness({ kind: "macro", value });
    await service.updateDraft({ id: USER_ID }, DRAFT_ID, {
      kind: "macro",
      value: { ...value, name: "Revised legacy" },
    });
    expect(repository.updateDraft).toHaveBeenCalledWith(USER_ID, DRAFT_ID, {
      kind: "macro",
      value: { ...value, name: "Revised legacy", visibility: "private" },
    });
  });

  it("refuses editing a missing or nonpending draft", async () => {
    const payload = { kind: "experiment", value: { name: "Plan", description } };
    const { service, repository, draft } = harness(payload);
    for (const existing of [null, { ...draft, status: "confirmed" }]) {
      repository.getDraft.mockResolvedValue(existing);
      await expect(service.updateDraft({ id: USER_ID }, DRAFT_ID, payload)).rejects.toMatchObject({
        code: "DRAFT_NOT_PENDING",
      });
    }
    expect(repository.updateDraft).not.toHaveBeenCalled();
  });

  it("encodes readable UTF-8 source exactly once and keeps the draft readable", async () => {
    const code = 'sample = ctx["sample_id"]["answer"]\nreturn {"sample": sample, "label": "葉"}\n';
    const { service, create, draft, repository } = harness({
      kind: "macro",
      value: {
        name: "Label readings",
        language: "python",
        description,
        code,
        codeEncoding: "utf8",
      },
    });
    const first = await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(create.execute).toHaveBeenCalledWith(
      {
        name: "Label readings",
        language: "python",
        description,
        visibility: "private",
        code: Buffer.from(code, "utf8").toString("base64"),
      },
      USER_ID,
      null,
    );
    expect(draft.payload.value).toMatchObject({ code, codeEncoding: "utf8" });
    repository.claimDraft.mockResolvedValue(null);
    repository.getDraft.mockResolvedValue({
      ...draft,
      status: "confirmed",
      createdEntity: first.created,
    });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(create.execute).toHaveBeenCalledOnce();
  });

  it("does not reinterpret legacy macro code", async () => {
    const code = Buffer.from('return {"reading": json["light_intensity"]}', "utf8").toString(
      "base64",
    );
    const { service, create } = harness({
      kind: "macro",
      value: { name: "Legacy", language: "python", code },
    });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(create.execute).toHaveBeenCalledWith(
      { name: "Legacy", language: "python", code, visibility: "private" },
      USER_ID,
      null,
    );
  });

  it("passes the entire protocol recipe and research description to the domain create use case", async () => {
    const code = [{ environmental: [["light_intensity"]] }];
    const { service, create } = harness({
      kind: "protocol",
      value: { name: "Ambient PAR", description, family: "multispeq", code },
    });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(create.execute).toHaveBeenCalledWith(
      { name: "Ambient PAR", description, family: "multispeq", code, visibility: "private" },
      USER_ID,
      null,
    );
  });

  it("rechecks embedded references and persists complete workbook cells", async () => {
    const { service, create, authorization, draft } = harness({
      kind: "workbook",
      value: { name: "Sun and shade", description, cells },
    });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(authorization.can).toHaveBeenCalledWith(USER_ID, {
      resourceType: "protocol",
      resourceId: PROTOCOL_ID,
      action: "read",
    });
    expect(authorization.can).toHaveBeenCalledWith(USER_ID, {
      resourceType: "macro",
      resourceId: MACRO_ID,
      action: "read",
    });
    expect(create.execute).toHaveBeenCalledWith(
      { ...draft.payload.value, visibility: "private" },
      USER_ID,
      null,
    );
  });

  it.each(["protocol", "macro"])(
    "refuses a workbook when %s access is revoked",
    async (deniedType) => {
      const { service, create, authorization, repository } = harness({
        kind: "workbook",
        value: { name: "Sun and shade", description, cells },
      });
      authorization.can.mockImplementation((_user, request: { resourceType: string }) =>
        Promise.resolve({ allow: request.resourceType !== deniedType }),
      );
      await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
        code: "DRAFT_FORBIDDEN",
      });
      expect(create.execute).not.toHaveBeenCalled();
      expect(repository.releaseDraftClaim).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    },
  );

  it("still checks the destination organization before any create", async () => {
    const { service, create, authorization } = harness({
      kind: "workbook",
      value: { name: "Sun and shade", description, cells, organizationId: ORG_ID },
    });
    authorization.isOrgMember.mockResolvedValue(false);
    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
      code: "DRAFT_FORBIDDEN",
    });
    expect(authorization.isOrgMember).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it("still checks the draft source before any create", async () => {
    const { service, create, authorization } = harness(
      {
        kind: "protocol",
        value: {
          name: "Ambient PAR",
          description,
          family: "multispeq",
          code: [{ environmental: [["light_intensity"]] }],
        },
      },
      {
        id: `protocol:${PROTOCOL_ID}`,
        type: "entity",
        title: "Source",
        entityType: "protocol",
        entityId: PROTOCOL_ID,
      },
    );
    authorization.can.mockResolvedValue({ allow: false });
    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
      code: "DRAFT_FORBIDDEN",
    });
    expect(create.execute).not.toHaveBeenCalled();
  });

  it("records creation then attaches the canonical design before confirming an experiment", async () => {
    const { service, create, authorization, repository, attach } = harness({
      kind: "experiment",
      value: { name: "Paired light trial", description, workbookId: PROTOCOL_ID },
    });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(authorization.can).toHaveBeenCalledWith(USER_ID, {
      resourceType: "workbook",
      resourceId: PROTOCOL_ID,
      action: "read",
    });
    expect(create.execute).toHaveBeenCalledWith(
      {
        name: "Paired light trial",
        description,
        visibility: "private",
        embargoUntil: undefined,
      },
      USER_ID,
      null,
    );
    expect(authorization.can).toHaveBeenCalledWith(USER_ID, {
      resourceType: "experiment",
      resourceId: CREATED_ID,
      action: "manage",
    });
    expect(attach.execute).toHaveBeenCalledWith(CREATED_ID, PROTOCOL_ID, USER_ID);
    expect(repository.recordDraftCreated.mock.invocationCallOrder[0]).toBeLessThan(
      attach.execute.mock.invocationCallOrder[0],
    );
    expect(attach.execute.mock.invocationCallOrder[0]).toBeLessThan(
      repository.finishDraft.mock.invocationCallOrder[0],
    );
  });

  it("retries failed attachment from the recorded experiment without duplicating creation", async () => {
    const { service, repository, create, draft, attach } = harness({
      kind: "experiment",
      value: { name: "Plan", description, workbookId: PROTOCOL_ID },
    });
    attach.execute.mockResolvedValueOnce(failure(AppError.internal("Flow write failed")));
    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toThrow(
      "Flow write failed",
    );
    expect(repository.recordDraftCreated).toHaveBeenCalledOnce();
    expect(repository.finishDraft).not.toHaveBeenCalled();
    expect(repository.releaseDraftClaim).not.toHaveBeenCalled();
    const createdEntity = {
      type: "experiment",
      id: CREATED_ID,
      name: "Plan",
      url: `/platform/experiments/${CREATED_ID}`,
    };
    repository.claimDraft.mockResolvedValue(null);
    repository.getDraft.mockResolvedValue({ ...draft, createdEntity });
    const result = await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(result.created).toEqual(createdEntity);
    expect(create.execute).toHaveBeenCalledOnce();
    expect(attach.execute).toHaveBeenCalledTimes(2);
    expect(repository.finishDraft).toHaveBeenCalledOnce();
    expect(repository.recordUsage).toHaveBeenCalledWith({
      userId: USER_ID,
      threadId: draft.threadId,
      organizationId: undefined,
      eventType: "draft_confirmed",
      entityType: "experiment",
    });
    repository.getDraft.mockResolvedValue({ ...draft, status: "confirmed", createdEntity });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(repository.recordUsage).toHaveBeenCalledOnce();
    expect(attach.execute).toHaveBeenCalledTimes(2);
  });

  it.each([
    { kind: "protocol", value: { name: "Existing", family: "multispeq", code: [] } },
    { kind: "macro", value: { name: "Existing", language: "python", code: "cmV0dXJuIHt9" } },
    { kind: "workbook", value: { name: "Existing", cells } },
    { kind: "experiment", value: { name: "Existing" } },
  ])(
    "finalizes an already-created $kind without replaying creation authorization",
    async ({ kind, value }) => {
      const source: AssistantSource = {
        id: `protocol:${PROTOCOL_ID}`,
        type: "entity",
        title: "Source",
        entityType: "protocol",
        entityId: PROTOCOL_ID,
      };
      const { service, repository, draft, attach, create, authorization } = harness(
        { kind, value: { ...value, organizationId: ORG_ID } },
        source,
      );
      const createdEntity = {
        type: kind,
        id: CREATED_ID,
        name: "Existing",
        url: "/platform/resource",
      };
      repository.claimDraft.mockResolvedValue(null);
      repository.getDraft.mockResolvedValue({ ...draft, createdEntity });
      authorization.can.mockResolvedValue({ allow: false });
      authorization.isOrgMember.mockResolvedValue(false);
      await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
      expect(repository.finishDraft).toHaveBeenCalledWith(
        USER_ID,
        DRAFT_ID,
        "confirmed",
        createdEntity,
      );
      expect(repository.recordUsage).toHaveBeenCalledWith({
        userId: USER_ID,
        threadId: draft.threadId,
        organizationId: ORG_ID,
        eventType: "draft_confirmed",
        entityType: kind,
      });
      expect(authorization.can).not.toHaveBeenCalled();
      expect(authorization.isOrgMember).not.toHaveBeenCalled();
      expect(create.execute).not.toHaveBeenCalled();
      expect(attach.execute).not.toHaveBeenCalled();
      repository.getDraft.mockResolvedValue({ ...draft, status: "confirmed", createdEntity });
      await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
      expect(repository.recordUsage).toHaveBeenCalledOnce();
    },
  );

  it("records no confirmation event if recovery did not finish the draft", async () => {
    const { service, repository, draft } = harness({
      kind: "experiment",
      value: { name: "Existing" },
    });
    repository.claimDraft.mockResolvedValue(null);
    repository.getDraft.mockResolvedValue({
      ...draft,
      createdEntity: {
        type: "experiment",
        id: CREATED_ID,
        name: "Existing",
        url: "/platform/experiments/existing",
      },
    });
    repository.finishDraft.mockResolvedValue(null);
    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
      code: "DRAFT_NOT_PENDING",
    });
    expect(repository.recordUsage).not.toHaveBeenCalled();
  });

  it("does not attach or retry creation when its ID was not durably recorded", async () => {
    const { service, repository, draft, attach, create } = harness({
      kind: "experiment",
      value: { name: "Plan", description, workbookId: PROTOCOL_ID },
    });
    repository.recordDraftCreated.mockResolvedValue(null);
    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
      code: "DRAFT_NOT_PENDING",
    });
    repository.claimDraft.mockResolvedValue(null);
    repository.getDraft.mockResolvedValue(draft);
    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
      code: "DRAFT_NOT_PENDING",
    });
    expect(create.execute).toHaveBeenCalledOnce();
    expect(attach.execute).not.toHaveBeenCalled();
    expect(repository.finishDraft).not.toHaveBeenCalled();
  });

  it.each(["source", "workbook", "organization", "experiment"])(
    "rechecks %s permission before completing a recovered attachment",
    async (denied) => {
      const source: AssistantSource = {
        id: `protocol:${MACRO_ID}`,
        type: "entity",
        title: "Source",
        entityType: "protocol",
        entityId: MACRO_ID,
      };
      const { service, repository, create, draft, attach, authorization } = harness(
        {
          kind: "experiment",
          value: { name: "Plan", description, workbookId: PROTOCOL_ID, organizationId: ORG_ID },
        },
        source,
      );
      repository.claimDraft.mockResolvedValue(null);
      repository.getDraft.mockResolvedValue({
        ...draft,
        createdEntity: {
          type: "experiment",
          id: CREATED_ID,
          name: "Plan",
          url: `/platform/experiments/${CREATED_ID}`,
        },
      });
      authorization.isOrgMember.mockResolvedValue(denied !== "organization");
      authorization.can.mockImplementation((_user, request: { resourceType: string }) =>
        Promise.resolve({
          allow: request.resourceType !== (denied === "source" ? "protocol" : denied),
        }),
      );
      await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
        code: "DRAFT_FORBIDDEN",
      });
      expect(create.execute).not.toHaveBeenCalled();
      expect(attach.execute).not.toHaveBeenCalled();
      expect(repository.finishDraft).not.toHaveBeenCalled();
    },
  );

  it("does not attach for experiments without a workbook or silently change already confirmed drafts", async () => {
    const { service, repository, draft, attach, create } = harness({
      kind: "experiment",
      value: { name: "Plan", description },
    });
    const first = await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(attach.execute).not.toHaveBeenCalled();
    repository.claimDraft.mockResolvedValue(null);
    repository.getDraft.mockResolvedValue({
      ...draft,
      status: "confirmed",
      createdEntity: first.created,
      payload: {
        kind: "experiment",
        value: { name: "Plan", description, workbookId: PROTOCOL_ID },
      },
    });
    await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    expect(create.execute).toHaveBeenCalledOnce();
    expect(attach.execute).not.toHaveBeenCalled();
  });
});
