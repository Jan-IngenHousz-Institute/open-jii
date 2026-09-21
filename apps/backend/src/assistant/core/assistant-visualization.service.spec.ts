import { ConfigService } from "@nestjs/config";
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import type { AssistantDraft } from "@repo/api/domains/assistant/assistant.schema";

import { success } from "../../common/utils/fp-utils";
import { AssistantService } from "./assistant.service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-000000000002";
const DRAFT_ID = "00000000-0000-4000-8000-000000000003";
const EXPERIMENT_ID = "00000000-0000-4000-8000-000000000004";
const VISUALIZATION_ID = "00000000-0000-4000-8000-000000000005";

const visualizationDraft: AssistantDraft = {
  id: DRAFT_ID,
  threadId: THREAD_ID,
  messageId: null,
  kind: "visualization",
  status: "confirming",
  payload: {
    kind: "visualization",
    value: {
      experimentId: EXPERIMENT_ID,
      name: "Treatment response",
      chartFamily: "basic",
      chartType: "line",
      dataConfig: {
        tableName: "measurements",
        dataSources: [
          { tableName: "measurements", columnName: "elapsed_time", role: "x" },
          { tableName: "measurements", columnName: "value", role: "y" },
        ],
      },
    },
  },
  source: null,
  createdEntity: null,
  createdAt: "2026-09-21T18:00:00.000Z",
  updatedAt: "2026-09-21T18:00:00.000Z",
};

describe("AssistantService visualization confirmation", () => {
  it("rechecks manage permission on the destination experiment", async () => {
    const repository = repositoryFor(visualizationDraft);
    const authorization = { can: vi.fn().mockResolvedValue({ allow: false }) };
    const createVisualization = { execute: vi.fn() };
    const service = createService(repository, authorization, createVisualization);

    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toMatchObject({
      code: "DRAFT_FORBIDDEN",
    });

    expect(authorization.can).toHaveBeenCalledWith(USER_ID, {
      resourceType: "experiment",
      resourceId: EXPERIMENT_ID,
      action: "manage",
    });
    expect(createVisualization.execute).not.toHaveBeenCalled();
    expect(repository.releaseDraftClaim).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
  });

  it("creates once and returns the confirmed result for a duplicate confirmation", async () => {
    const confirmed = {
      ...visualizationDraft,
      status: "confirmed" as const,
      createdEntity: {
        type: "visualization" as const,
        id: VISUALIZATION_ID,
        name: "Treatment response",
        url: `/platform/experiments/${EXPERIMENT_ID}/analysis/visualizations/${VISUALIZATION_ID}`,
      },
    };
    const repository = repositoryFor(visualizationDraft);
    repository.claimDraft.mockResolvedValueOnce(visualizationDraft).mockResolvedValueOnce(null);
    repository.getDraft.mockResolvedValue(confirmed);
    repository.recordDraftCreated.mockResolvedValue({
      ...visualizationDraft,
      createdEntity: confirmed.createdEntity,
    });
    repository.finishDraft.mockResolvedValue(confirmed);
    const authorization = { can: vi.fn().mockResolvedValue({ allow: true }) };
    const createVisualization = {
      execute: vi.fn().mockResolvedValue(
        success({
          id: VISUALIZATION_ID,
          name: "Treatment response",
        }),
      ),
    };
    const service = createService(repository, authorization, createVisualization);

    const first = await service.confirmDraft({ id: USER_ID }, DRAFT_ID);
    const duplicate = await service.confirmDraft({ id: USER_ID }, DRAFT_ID);

    expect(first.created).toEqual(confirmed.createdEntity);
    expect(duplicate).toEqual({ draft: confirmed, created: confirmed.createdEntity });
    expect(createVisualization.execute).toHaveBeenCalledTimes(1);
    expect(createVisualization.execute).toHaveBeenCalledWith(
      EXPERIMENT_ID,
      expect.objectContaining({ name: "Treatment response", chartType: "line" }),
      USER_ID,
    );
    expect(repository.finishDraft).toHaveBeenCalledTimes(1);
  });

  it("recovers a created entity after confirmation finalization was interrupted", async () => {
    const createdEntity = {
      type: "visualization" as const,
      id: VISUALIZATION_ID,
      name: "Treatment response",
      url: `/platform/experiments/${EXPERIMENT_ID}/analysis/visualizations/${VISUALIZATION_ID}`,
    };
    const interrupted = { ...visualizationDraft, createdEntity };
    const confirmed = { ...interrupted, status: "confirmed" as const };
    const repository = repositoryFor(visualizationDraft);
    repository.claimDraft.mockResolvedValue(null);
    repository.getDraft.mockResolvedValue(interrupted);
    repository.finishDraft.mockResolvedValue(confirmed);
    const createVisualization = { execute: vi.fn() };
    const service = createService(
      repository,
      { can: vi.fn().mockResolvedValue({ allow: true }) },
      createVisualization,
    );

    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).resolves.toEqual({
      draft: confirmed,
      created: createdEntity,
    });
    expect(createVisualization.execute).not.toHaveBeenCalled();
    expect(repository.finishDraft).toHaveBeenCalledWith(
      USER_ID,
      DRAFT_ID,
      "confirmed",
      createdEntity,
    );
  });

  it("never releases the claim after the create side effect has started", async () => {
    const repository = repositoryFor(visualizationDraft);
    repository.recordDraftCreated.mockRejectedValue(new Error("database unavailable"));
    const createVisualization = {
      execute: vi.fn().mockResolvedValue(
        success({
          id: VISUALIZATION_ID,
          name: "Treatment response",
        }),
      ),
    };
    const service = createService(
      repository,
      { can: vi.fn().mockResolvedValue({ allow: true }) },
      createVisualization,
    );

    await expect(service.confirmDraft({ id: USER_ID }, DRAFT_ID)).rejects.toThrow(
      "database unavailable",
    );
    expect(createVisualization.execute).toHaveBeenCalledOnce();
    expect(repository.releaseDraftClaim).not.toHaveBeenCalled();
  });
});

function repositoryFor(draft: AssistantDraft) {
  return {
    claimDraft: vi.fn().mockResolvedValue(draft),
    getDraft: vi.fn(),
    recordDraftCreated: vi.fn(),
    finishDraft: vi.fn(),
    releaseDraftClaim: vi.fn(),
    recordUsage: vi.fn(),
  };
}

function createService(
  repository: ReturnType<typeof repositoryFor>,
  authorization: { can: ReturnType<typeof vi.fn> },
  createVisualization: { execute: ReturnType<typeof vi.fn> },
): AssistantService {
  return new AssistantService(
    new ConfigService({ assistant: { enabled: true } }),
    {} as never,
    authorization as never,
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    createVisualization as never,
    {} as never,
    {} as never,
    {} as never,
    fromPartial({}),
  );
}
