import { server } from "@/test/msw/server";
import { fireEvent, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { AssistantDraft } from "@repo/api/domains/assistant/assistant.schema";

import { AssistantDraftCard } from "./assistant-draft-card";

const draft: AssistantDraft = {
  id: "10000000-0000-4000-8000-000000000001",
  threadId: "10000000-0000-4000-8000-000000000002",
  messageId: "10000000-0000-4000-8000-000000000003",
  kind: "experiment",
  status: "pending",
  payload: {
    kind: "experiment",
    value: {
      name: "Barley drought trial",
      description: "Three greenhouse blocks",
      visibility: "private",
      organizationId: "10000000-0000-4000-8000-000000000004",
    },
  },
  source: {
    id: "starter-1",
    type: "public",
    title: "Nergena barley 2025",
  },
  createdEntity: null,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z",
};

const visualizationDraft: AssistantDraft = {
  ...draft,
  id: "10000000-0000-4000-8000-000000000005",
  kind: "visualization",
  payload: {
    kind: "visualization",
    value: {
      experimentId: "10000000-0000-4000-8000-000000000006",
      name: "Mean PAR by plot",
      chartFamily: "basic",
      chartType: "bar",
      dataConfig: {
        tableName: "measurements",
        dataSources: [
          { tableName: "measurements", columnName: "plot", role: "x" },
          { tableName: "measurements", columnName: "par", role: "y", aggregate: "avg" },
        ],
      },
    },
  },
  source: null,
};

const recoveringDraft: AssistantDraft = {
  ...draft,
  status: "confirming",
  createdEntity: {
    type: "experiment",
    id: "10000000-0000-4000-8000-000000000008",
    name: "Barley drought trial",
    url: "/platform/experiments/10000000-0000-4000-8000-000000000008",
  },
};

const macroCode = [
  'sample = ctx.get("sample_id", {}).get("answer")',
  "if sample:",
  '    return {"sample": sample}',
  'return {"sample": None}',
].join("\n");

const macroDescription = [
  "Reads the sample identifier from context.",
  "Returns an explicit null when the identifier is absent.",
].join("\n");

const macroDraft: AssistantDraft = {
  ...draft,
  id: "10000000-0000-4000-8000-000000000007",
  kind: "macro",
  payload: {
    kind: "macro",
    value: {
      name: "Read sample identifier",
      description: macroDescription,
      language: "python",
      code: macroCode,
      codeEncoding: "utf8",
      visibility: "private",
    },
  },
  source: null,
};

describe("AssistantDraftCard", () => {
  it("shows every saved field and waits for confirmation", () => {
    render(<AssistantDraftCard draft={draft} />);

    expect(screen.getByText("Barley drought trial")).toBeInTheDocument();
    expect(screen.getByText("Three greenhouse blocks")).toBeInTheDocument();
    expect(screen.getByText("private")).toBeInTheDocument();
    expect(screen.getByText("10000000-0000-4000-8000-000000000004")).toBeInTheDocument();
    expect(screen.getByText("Nergena barley 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "draft.confirm" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /draft.openCreated/ })).not.toBeInTheDocument();
  });

  it("lets the researcher edit primitive fields inline", async () => {
    const user = userEvent.setup();
    render(<AssistantDraftCard draft={draft} />);

    await user.click(screen.getByRole("button", { name: "draft.edit" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Barley drought trial 2027");

    expect(name).toHaveValue("Barley drought trial 2027");
    expect(screen.getByRole("button", { name: "draft.saveChanges" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "draft.cancelEdit" })).toBeInTheDocument();
  });

  it("retries an interrupted confirmation without presenting the entity as complete", async () => {
    const user = userEvent.setup();
    const confirmedDraft = { ...recoveringDraft, status: "confirmed" as const };
    const confirmSpy = server.mount(contract.assistant.confirmDraft, {
      body: { draft: confirmedDraft, created: recoveringDraft.createdEntity },
    });
    const { rerender } = render(<AssistantDraftCard draft={recoveringDraft} />);

    expect(screen.queryByRole("link", { name: /draft.openCreated/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "draft.edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "draft.discard" })).not.toBeInTheDocument();
    expect(screen.getByText("draft.retryConfirmationHelp")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "draft.retryConfirmation" }));

    await waitFor(() => expect(confirmSpy.called).toBe(true));
    expect(confirmSpy.params).toEqual({ draftId: recoveringDraft.id });
    expect(confirmSpy.callCount).toBe(1);

    rerender(<AssistantDraftCard draft={confirmedDraft} />);
    expect(screen.getByRole("link", { name: /draft.openCreated/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "draft.retryConfirmation" }),
    ).not.toBeInTheDocument();
  });

  it("makes a visualization destination and structured data configuration inspectable", async () => {
    const user = userEvent.setup();
    render(<AssistantDraftCard draft={visualizationDraft} />);

    expect(screen.getByText("10000000-0000-4000-8000-000000000006")).toBeInTheDocument();
    expect(screen.getByText(/measurements/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "draft.edit" }));
    const dataConfig = screen.getByRole("textbox", {
      name: "draft.visualization.fields.dataConfig",
    });
    await user.clear(dataConfig);
    await user.type(dataConfig, "not json");

    expect(screen.getByRole("alert")).toHaveTextContent("draft.invalidJson");
    expect(screen.getByRole("button", { name: "draft.saveChanges" })).toBeDisabled();
  });

  it("preserves multiline macro source and its encoding through an edit", async () => {
    const user = userEvent.setup();
    const updateSpy = server.mount(contract.assistant.updateDraft, { body: macroDraft });
    render(<AssistantDraftCard draft={macroDraft} />);

    const codeRow = screen.getByText("Code", { exact: true }).closest("div");
    const descriptionRow = screen.getByText("Description", { exact: true }).closest("div");
    const displayedCode = codeRow?.querySelector("pre");
    const displayedDescription = descriptionRow?.querySelector("pre");
    expect(displayedCode?.textContent).toBe(macroCode);
    expect(displayedCode).toHaveClass("overflow-x-auto", "whitespace-pre", "font-mono");
    expect(displayedDescription?.textContent).toBe(macroDescription);
    expect(displayedDescription).toHaveClass("whitespace-pre-wrap");
    expect(screen.queryByText("Code Encoding")).not.toBeInTheDocument();
    expect(screen.queryByText("utf8")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "draft.edit" }));
    const codeEditor = screen.getByRole("textbox", { name: "Code" });
    const descriptionEditor = screen.getByRole("textbox", { name: "Description" });
    expect(codeEditor.tagName).toBe("TEXTAREA");
    expect(descriptionEditor.tagName).toBe("TEXTAREA");
    expect(codeEditor).toHaveValue(macroCode);
    expect(descriptionEditor).toHaveValue(macroDescription);

    const updatedCode = `${macroCode}\noutput["reviewed"] = True`;
    fireEvent.change(codeEditor, { target: { value: updatedCode } });
    await user.click(screen.getByRole("button", { name: "draft.saveChanges" }));

    await waitFor(() => expect(updateSpy.called).toBe(true));
    expect(updateSpy.params).toEqual({ draftId: macroDraft.id });
    expect(updateSpy.body).toEqual({
      payload: {
        kind: "macro",
        value: {
          ...macroDraft.payload.value,
          code: updatedCode,
          codeEncoding: "utf8",
        },
      },
    });
  });
});
