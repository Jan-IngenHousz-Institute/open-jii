import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { EmptyWorkbookState } from "./empty-workbook-state";

const workbooks = [
  createWorkbook({ id: "wb-1", name: "Workbook One" }),
  createWorkbook({ id: "wb-2", name: "Workbook Two" }),
];

describe("EmptyWorkbookState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.workbooks.listWorkbooks, { body: workbooks });
  });

  it("renders title and description", () => {
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess />);
    expect(screen.getByText("flow.title")).toBeInTheDocument();
    expect(screen.getByText("flow.description")).toBeInTheDocument();
  });

  it("shows the empty state message", () => {
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess />);
    expect(screen.getByText("flow.noWorkbookLinked")).toBeInTheDocument();
    expect(screen.getByText("flow.linkWorkbookPrompt")).toBeInTheDocument();
  });

  it("hides attach controls when hasAccess is false", () => {
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess={false} />);
    expect(screen.queryByText("flow.attach")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows attach button and select when hasAccess is true", () => {
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flow\.attach/ })).toBeInTheDocument();
  });

  it("disables attach button when no workbook is selected", () => {
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess />);
    expect(screen.getByRole("button", { name: /flow\.attach/ })).toBeDisabled();
  });

  it("attaches workbook and shows success toast", async () => {
    const spy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-1", workbookVersionId: "ver-1", version: 1 },
    });
    const user = userEvent.setup();
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess />);

    // Open select and pick a workbook
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Workbook One"));

    // Click attach
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
    render(<EmptyWorkbookState experimentId="exp-1" hasAccess />);

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
});
