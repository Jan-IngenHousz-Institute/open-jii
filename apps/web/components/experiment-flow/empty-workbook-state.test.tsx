import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { structuralIssue, structuralValidationErrorBody } from "@/test/orpc-error";
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
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);
    expect(screen.getByText("flow.title")).toBeInTheDocument();
    expect(screen.getByText("flow.description")).toBeInTheDocument();
  });

  it("shows the empty state message", () => {
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);
    expect(screen.getByText("flow.noWorkbookLinked")).toBeInTheDocument();
    expect(screen.getByText("flow.linkWorkbookPrompt")).toBeInTheDocument();
  });

  it("hides attach controls when hasAccess is false", () => {
    render(
      <EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess={false} />,
    );
    expect(screen.queryByText("flow.attach")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows attach button and select when hasAccess is true", () => {
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flow\.attach/ })).toBeInTheDocument();
  });

  it("disables attach button when no workbook is selected", () => {
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);
    expect(screen.getByRole("button", { name: /flow\.attach/ })).toBeDisabled();
  });

  it("attaches workbook and shows success toast", async () => {
    const spy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-1", workbookVersionId: "ver-1", version: 1 },
    });
    const user = userEvent.setup();
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);

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
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);

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

  it("shows repairable structural issues inline (keyed by command) with no leak, not a toast", async () => {
    server.mount(contract.experiments.attachWorkbook, {
      status: 400,
      body: structuralValidationErrorBody(
        [structuralIssue({ commandCellId: "cmd-x", secretLeak: "TOP-SECRET" })],
        { secretTop: "TOP-SECRET" },
      ),
    });
    const user = userEvent.setup();
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Workbook One"));
    await user.click(screen.getByRole("button", { name: /flow\.attach/ }));

    const issues = await screen.findByTestId("structural-issues");
    // The async-inserted block is an atomic live alert for AT.
    expect(issues).toHaveAttribute("role", "alert");
    expect(issues).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByRole("alert")).toBe(issues);
    expect(issues).toHaveTextContent("cmd-x");
    expect(issues).toHaveTextContent(/cells\.commandDynamic\.issue\.sourceMissing/);
    // A link to open the offending workbook for repair.
    expect(
      screen.getByRole("link", { name: "flow.structuralAttach.openWorkbook" }),
    ).toHaveAttribute("href", "/en-US/platform/workbooks/wb-1");
    // No sentinel leaks, and the generic failure toast is not used.
    expect(screen.queryByText(/TOP-SECRET/)).not.toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith({
      description: "flow.attachFailed",
      variant: "destructive",
    });
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
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("button", { name: /flow\.createNew/ }));

    await waitFor(() => expect(createSpy.called).toBe(true));
    expect(createSpy.body).toMatchObject({ name: "flow.newWorkbookName" });
    await waitFor(() => expect(attachSpy.called).toBe(true));
    expect(attachSpy.body).toMatchObject({ workbookId: "wb-new" });
  });

  it("shows error toast when workbook creation fails", async () => {
    server.mount(contract.workbooks.createWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<EmptyWorkbookState experimentId="exp-1" experimentName="My Experiment" hasAccess />);

    await user.click(screen.getByRole("button", { name: /flow\.createNew/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.createFailed",
        variant: "destructive",
      }),
    );
  });
});
