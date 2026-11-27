import { experimentAccessQuery } from "@/hooks/experiment/useExperimentAccess/experiment-access-query";
import { orpc } from "@/lib/orpc";
import {
  createExperimentAccess,
  createExperimentDashboard,
  createSession,
  createUseSessionResult,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import {
  act,
  assertExists,
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import { onlineManager } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient, useSession } from "@repo/auth/client";
import type { ToastActionElement } from "@repo/ui/components/toast";
import { Toast, ToastProvider, ToastViewport } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

import { AutosaveStatusProvider } from "../../shared/autosave/autosave-status-context";
import type { DashboardFormValues } from "../dashboard-form-shell";
import { useDashboardCopySave } from "./context/dashboard-copy-save-context";
import { DashboardEditorProvider, useDashboardEditor } from "./context/dashboard-editor-context";
import { DashboardAutosaveBoundary } from "./dashboard-autosave-boundary";

const session = createSession();
const source = createVisualization({ id: "source", name: "Growth" });
const copy = createVisualization({ id: "copy", name: "Growth (copy)" });
const sourceWidget = createVisualizationWidget({
  config: { visualizationId: source.id, showTitle: true, showDescription: false },
});
const dashboard = createExperimentDashboard({ id: "dash-1", widgets: [sourceWidget] });
const accessQuery = experimentAccessQuery(orpc, session.user.id, "exp-1");
const activeAccess = createExperimentAccess({
  experiment: { id: "exp-1", status: "active" },
  isAdmin: true,
});
const activeCopyHref = "/en-US/platform/experiments/exp-1/analysis/visualizations/copy";
const archivedCopyHref = "/en-US/platform/experiments-archive/exp-1/analysis/visualizations/copy";
const failureTitle = "editor.inspector.copySaveFailed";
const recoveryTitle = "editor.inspector.copyNotAttached";
const namedOpenLabel = "editor.inspector.openChartCopyNamed";
const retryLabel = "editor.inspector.retryCopySave";

function Actions({ widgets }: { widgets: DashboardFormValues["widgets"] }) {
  const { selectWidget } = useDashboardEditor();
  const recovery = useDashboardCopySave();
  assertExists(recovery);

  return (
    <>
      <button onClick={() => selectWidget(sourceWidget.id)}>Select source</button>
      <button
        disabled={recovery.duplicateDisabled}
        onClick={() => void recovery.duplicateSelectedChart()}
      >
        Duplicate
      </button>
      {recovery.retryAvailable && <button onClick={recovery.retry}>Retry</button>}
      {recovery.openCopyHref && <a href={recovery.openCopyHref}>Open copy</a>}
      <output aria-label="Charts">
        {widgets
          .flatMap((widget) =>
            widget.type === "visualization" ? [widget.config.visualizationId] : [],
          )
          .join(", ")}
      </output>
    </>
  );
}

function Editor() {
  const form = useForm<DashboardFormValues>({
    defaultValues: {
      name: dashboard.name,
      layout: dashboard.layout,
      widgets: dashboard.widgets,
    },
  });
  const widgets = useWatch({ control: form.control, name: "widgets" });

  return (
    <AutosaveStatusProvider>
      <DashboardEditorProvider>
        <DashboardAutosaveBoundary form={form} experimentId="exp-1" dashboardId="dash-1" enabled>
          <Actions widgets={widgets} />
        </DashboardAutosaveBoundary>
      </DashboardEditorProvider>
    </AutosaveStatusProvider>
  );
}

async function startDuplicate(unblock?: Promise<void>) {
  const create = server.mount(contract.experiments.createExperimentVisualization, {
    body: copy,
    unblock,
  });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(accessQuery.queryKey, activeAccess);
  const user = userEvent.setup();
  const editor = render(<Editor />, { queryClient });
  expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Select source" }));
  await user.click(screen.getByRole("button", { name: "Duplicate" }));
  await waitFor(() => expect(create.callCount).toBe(1));
  return { ...editor, queryClient, user, create };
}

function getToast(title: string) {
  return vi.mocked(toast).mock.calls.find(([value]) => value.title === title)?.[0];
}

async function waitForToast(title: string) {
  return waitFor(
    () => {
      const payload = getToast(title);
      expect(payload, `Expected toast ${title}`).toBeDefined();
      assertExists(payload);
      return payload;
    },
    { timeout: 2_000 },
  );
}

function renderToastActions(action: ToastActionElement | undefined) {
  render(
    <ToastProvider>
      <Toast>{action}</Toast>
      <ToastViewport />
    </ToastProvider>,
  );
}

describe("DashboardAutosaveBoundary", () => {
  beforeEach(() => {
    vi.mocked(toast).mockReturnValue({ id: "copy-toast", dismiss: vi.fn(), update: vi.fn() });
    vi.mocked(useSession).mockReturnValue(createUseSessionResult({ data: session }));
    vi.mocked(authClient.getSession).mockResolvedValue({ data: session, error: null });
    server.mount(contract.experiments.getExperimentAccess, { body: activeAccess });
    server.mount(contract.experiments.getExperimentDashboard, { body: dashboard });
    server.mount(contract.experiments.getExperimentVisualization, { body: source });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [source] });
  });

  afterEach(() => {
    vi.mocked(useSession).mockReturnValue(createUseSessionResult());
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null, error: null });
    onlineManager.setOnline(true);
  });

  it("reports the copy when the boundary unmounts during chart creation", async () => {
    const creation = Promise.withResolvers<void>();
    const save = server.mount(contract.experiments.updateExperimentDashboard, { body: dashboard });
    try {
      const editor = await startDuplicate(creation.promise);
      expect(screen.getByLabelText("Charts")).toHaveTextContent(/^source$/u);
      editor.unmount();
    } finally {
      creation.resolve();
    }

    const recovery = await waitForToast(recoveryTitle);
    expect(recovery.action?.props).toMatchObject({
      altText: namedOpenLabel,
      children: { props: { href: activeCopyHref } },
    });
    expect(save.callCount).toBe(0);
  });

  it("waits for the originating session and uses the refreshed archived route", async () => {
    const creation = Promise.withResolvers<void>();
    try {
      const editor = await startDuplicate(creation.promise);
      editor.unmount();
      vi.mocked(authClient.getSession).mockRejectedValueOnce(new TypeError("Failed to fetch"));
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ experiment: { id: "exp-1", status: "archived" } }),
      });
      onlineManager.setOnline(false);
    } finally {
      creation.resolve();
    }

    await waitFor(() => expect(authClient.getSession).toHaveBeenCalledTimes(1));
    expect(getToast(recoveryTitle)).toBeUndefined();
    onlineManager.setOnline(true);
    const recovery = await waitForToast(recoveryTitle);
    expect(recovery.action?.props).toMatchObject({
      children: { props: { href: archivedCopyHref } },
    });
  });

  it("offers Open copy and retries the pending widget save when session verification fails", async () => {
    vi.mocked(authClient.getSession).mockRejectedValue(new TypeError("Failed to fetch"));
    const failed = server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });
    const { create, user } = await startDuplicate();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();
    expect(screen.getByLabelText("Charts")).toHaveTextContent("source, copy");
    expect(screen.getByRole("link", { name: "Open copy" })).toHaveAttribute("href", activeCopyHref);
    const failure = await waitForToast(failureTitle);
    renderToastActions(failure.action);
    expect(screen.getByRole("link", { name: "editor.inspector.openChartCopy" })).toHaveAttribute(
      "href",
      activeCopyHref,
    );

    const saved = server.mount(contract.experiments.updateExperimentDashboard, { body: dashboard });
    await user.click(screen.getByRole("button", { name: retryLabel }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Duplicate" })).toBeEnabled());
    expect(saved.body).toEqual(failed.body);
    expect(create.callCount).toBe(1);
  });

  it("hides Open copy after a confirmed read denial even when the older access data is cached", async () => {
    const attachment = Promise.withResolvers<void>();
    const save = server.mount(contract.experiments.updateExperimentDashboard, {
      status: 500,
      unblock: attachment.promise,
    });
    const { queryClient } = await startDuplicate();
    try {
      await waitFor(() => expect(save.callCount).toBe(1));
      server.mount(contract.experiments.getExperimentAccess, { status: 403 });
      await act(async () => {
        await expect(
          queryClient.fetchQuery({ ...accessQuery, retry: false }),
        ).rejects.toMatchObject({
          status: 403,
        });
      });
      expect(queryClient.getQueryData(accessQuery.queryKey)).toEqual(activeAccess);
    } finally {
      attachment.resolve();
    }

    expect(await screen.findByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Open copy" })).toBeNull();
    const failure = await waitForToast(failureTitle);
    renderToastActions(failure.action);
    expect(screen.getByRole("button", { name: retryLabel })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "editor.inspector.openChartCopy" })).toBeNull();
  });

  it.each([
    { change: "sign-out", data: null },
    { change: "new session", data: createSession({ session: { id: "other-session" } }) },
  ])("suppresses the failure toast after a confirmed $change", async ({ data }) => {
    const verification = Promise.withResolvers<Awaited<ReturnType<typeof authClient.getSession>>>();
    vi.mocked(authClient.getSession).mockReturnValue(verification.promise);
    server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });

    await startDuplicate();
    try {
      await waitFor(() => expect(authClient.getSession).toHaveBeenCalled());
    } finally {
      await act(() => {
        verification.resolve({ data, error: null });
        return verification.promise;
      });
    }
    expect(getToast(failureTitle)).toBeUndefined();
  });
});
