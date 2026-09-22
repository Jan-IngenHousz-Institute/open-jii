import type { IotBrowserSupport } from "@/hooks/iot/useIotBrowserSupport";
import { createCalibrationDefinitionDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound, useParams, usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import CalibrationDefinitionLayout from "./layout";

const DEFINITION_ID = "7a54c0bf-8293-4db0-a96f-958dbdfc7648";
const DETAIL_PATH = `/en-US/platform/calibrations/${DEFINITION_ID}`;

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));

vi.mock("@/components/calibrations/calibration-layout-content", () => ({
  CalibrationLayoutContent: ({
    actions,
    showTabs,
    children,
  }: {
    actions: React.ReactNode;
    showTabs?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="actions">{actions}</div>
      {showTabs !== false && <div data-testid="tabs" />}
      {children}
    </div>
  ),
}));

const mockSupport = vi.fn<() => IotBrowserSupport>();

vi.mock("@/hooks/iot/useIotBrowserSupport", () => ({
  useIotBrowserSupport: () => mockSupport(),
}));

function renderLayout() {
  return render(
    <CalibrationDefinitionLayout>
      <div data-testid="child">Child</div>
    </CalibrationDefinitionLayout>,
  );
}

describe("CalibrationDefinitionLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupport.mockReturnValue({
      bluetooth: false,
      serial: true,
      any: true,
      bluetoothReason: "browser",
      serialReason: null,
    });
    vi.mocked(useParams).mockReturnValue({ definitionId: DEFINITION_ID });
    vi.mocked(usePathname).mockReturnValue(DETAIL_PATH);
  });

  it("shows a loading message while the definition is on its way", () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID }),
      delay: 999_999,
    });
    renderLayout();

    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("shows an error rather than an empty shell when the definition cannot be read", async () => {
    server.mount(contract.iot.getCalibrationDefinition, { status: 500 });
    renderLayout();

    await waitFor(
      () => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("calls notFound for a definition that is not there", async () => {
    server.mount(contract.iot.getCalibrationDefinition, { status: 404 });
    renderLayout();

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("renders the definition, its tabs and the page under it", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID, name: "Ambit factory" }),
    });
    renderLayout();

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
    expect(screen.getByTestId("tabs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /iot.calibration.trial.action/ })).toHaveAttribute(
      "href",
      `${DETAIL_PATH}/run`,
    );
  });

  // The platform never reaches hardware itself, so without Web Serial there is no bench to
  // send anyone to, and the action has to say why rather than fail on the next screen.
  it("disables the bench where the browser cannot open a port", async () => {
    mockSupport.mockReturnValue({
      bluetooth: false,
      serial: false,
      any: false,
      bluetoothReason: "browser",
      serialReason: "browser",
    });
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID }),
    });
    renderLayout();

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /iot.calibration.trial.action/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /iot.calibration.trial.action/ })).toBeNull();
  });

  // A run records which definition it ran rather than a copy, so a definition a run points
  // at is frozen and duplicating is the only route on.
  it("offers a duplicate only once a run has closed the definition", async () => {
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID, runCount: 0 }),
    });
    const { unmount } = renderLayout();

    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /duplicate/i })).toBeNull();
    unmount();

    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID, runCount: 3 }),
    });
    renderLayout();

    await waitFor(() => {
      expect(screen.getByText("iot.calibration.detail.duplicate")).toBeInTheDocument();
    });
  });

  // The bench is a full-page tool with its own way back; a tab strip above it would offer
  // to navigate away mid-run.
  it("drops the tabs and offers only Back while a bench session is open", async () => {
    vi.mocked(usePathname).mockReturnValue(`${DETAIL_PATH}/run`);
    server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinitionDetail({ id: DEFINITION_ID, runCount: 3 }),
    });
    renderLayout();

    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument());
    expect(screen.queryByTestId("tabs")).toBeNull();
    expect(screen.getByRole("link", { name: /common.back/ })).toHaveAttribute("href", DETAIL_PATH);
    expect(screen.queryByText("iot.calibration.detail.duplicate")).toBeNull();
  });
});
