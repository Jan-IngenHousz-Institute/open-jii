import { orpcClient } from "@/lib/orpc";
import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useState } from "react";
import type { ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { WorkbookPersistenceCoordinatorProvider } from "../workbook/workbook-persistence-coordinator";
import { EmptyWorkbookState } from "./empty-workbook-state";

const workbooks = [
  createWorkbook({ id: "wb-1", name: "Workbook One" }),
  createWorkbook({ id: "wb-2", name: "Workbook Two" }),
];

function PersistenceHarness({ children }: { children: ReactElement }) {
  const [workbookId, setWorkbookId] = useState("");
  const persistence = {
    autosave: {
      status: "idle" as const,
      isDirty: false,
      isSaving: false,
      hasError: false,
      hasUnsavedChanges: false,
      error: null,
      flush: () => Promise.resolve(),
    },
    entitySaved: () => Promise.resolve(),
    manualUpgrade: () => Promise.resolve(),
    renameWorkbook: () => Promise.resolve(),
    attachWorkbook: async (nextWorkbook: { id: string; revision: number }) => {
      await orpcClient.experiments.attachWorkbook({
        id: "exp-1",
        workbookId: nextWorkbook.id,
        expectedWorkbookId: workbookId || null,
        expectedWorkbookVersionId: null,
        expectedWorkbookRevision: nextWorkbook.revision,
      });
      setWorkbookId(nextWorkbook.id);
    },
    detachWorkbook: () => Promise.resolve(),
    setWorkbookVersion: () => Promise.resolve(),
    retryFailed: () => Promise.resolve(),
    isPending: false,
    error: null,
  };
  return (
    <WorkbookPersistenceCoordinatorProvider coordinator={persistence}>
      {children}
    </WorkbookPersistenceCoordinatorProvider>
  );
}

function renderState(element: ReactElement) {
  return render(<PersistenceHarness>{element}</PersistenceHarness>);
}

describe("EmptyWorkbookState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.workbooks.listWorkbooks, { body: workbooks });
  });

  it("renders title and description", () => {
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);
    expect(screen.getByText("flow.title")).toBeInTheDocument();
    expect(screen.getByText("flow.description")).toBeInTheDocument();
  });

  it("shows the empty state message", () => {
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);
    expect(screen.getByText("flow.noWorkbookLinked")).toBeInTheDocument();
    expect(screen.getByText("flow.linkWorkbookPrompt")).toBeInTheDocument();
  });

  it("hides attach controls when hasAccess is false", () => {
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess={false} />);
    expect(screen.queryByText("flow.attach")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows attach button and select when hasAccess is true", () => {
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flow\.attach/ })).toBeInTheDocument();
  });

  it("disables attach button when no workbook is selected", () => {
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);
    expect(screen.getByRole("button", { name: /flow\.attach/ })).toBeDisabled();
  });

  it("attaches workbook and shows success toast", async () => {
    const spy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-1", workbookVersionId: "ver-1", version: 1 },
    });
    const user = userEvent.setup();
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Workbook One"));

    await user.click(screen.getByRole("button", { name: /flow\.attach/ }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ workbookId: "wb-1" });
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ description: "flow.workbookAttached" }),
    );
  });

  it("shows error toast on attach failure", async () => {
    server.mount(contract.experiments.attachWorkbook, { status: 500 });
    const user = userEvent.setup();
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Workbook One"));
    await user.click(screen.getByRole("button", { name: /flow\.attach/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.attachFailed",
        variant: "destructive",
      }),
    );
  });

  it("creates a new workbook and attaches it", async () => {
    const createSpy = server.mount(contract.workbooks.createWorkbook, {
      body: createWorkbook({ id: "wb-new", name: "My Experiment - Workbook" }),
      status: 201,
    });
    const attachSpy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-new", workbookVersionId: "ver-1", version: 1 },
    });
    const user = userEvent.setup();
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("button", { name: /flow\.createNew/ }));

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toMatchObject({ name: "flow.newWorkbookName" });
    await waitFor(() => expect(attachSpy.called).toBe(true));
    expect(attachSpy.body).toMatchObject({ workbookId: "wb-new" });
  });

  it("shows error toast when workbook creation fails", async () => {
    server.mount(contract.workbooks.createWorkbook, { status: 500 });
    const user = userEvent.setup();
    renderState(<EmptyWorkbookState experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("button", { name: /flow\.createNew/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.createFailed",
        variant: "destructive",
      }),
    );
  });
});
