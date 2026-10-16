import {
  AutosaveStatusProvider,
  useReportAutosaveStatus,
} from "@/components/shared/autosave/autosave-status-context";
import { createCalibrationDefinitionDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { CalibrationDeleteAction } from "./calibration-delete-action";

/** Stands in for the definition page while an edit waits on its autosave. */
function UnsavedEdit() {
  useReportAutosaveStatus({ status: "dirty", error: null });
  return null;
}

describe("CalibrationDeleteAction", () => {
  it("deletes after a confirm, then returns to the library", async () => {
    const remove = server.mount(contract.iot.deleteCalibrationDefinition, { status: 204 });
    const user = userEvent.setup();
    const definition = createCalibrationDefinitionDetail({ name: "MiniPAR PAR calibration" });

    const { router } = render(<CalibrationDeleteAction definition={definition} />);

    await user.click(screen.getByRole("button", { name: /iot\.calibration\.detail\.delete/ }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByText("iot.calibration.detail.delete"));

    await vi.waitFor(() => {
      expect(remove.calls).toHaveLength(1);
    });
    expect(remove.params.definitionId).toBe(definition.id);
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/en-US/platform/calibrations");
    });
  });

  // The page flushes an unsaved edit on the way out, which would land on the deleted definition.
  it("waits for an unsaved edit before it can delete", () => {
    const definition = createCalibrationDefinitionDetail();

    render(
      <AutosaveStatusProvider>
        <UnsavedEdit />
        <CalibrationDeleteAction definition={definition} />
      </AutosaveStatusProvider>,
    );

    expect(screen.getByRole("button", { name: /iot\.calibration\.detail\.delete/ })).toBeDisabled();
  });

  // A run recorded between opening the page and confirming makes the server refuse.
  it("stays on the page when the server refuses", async () => {
    const remove = server.mount(contract.iot.deleteCalibrationDefinition, { status: 400 });
    const user = userEvent.setup();
    const definition = createCalibrationDefinitionDetail();

    const { router } = render(<CalibrationDeleteAction definition={definition} />);

    await user.click(screen.getByRole("button", { name: /iot\.calibration\.detail\.delete/ }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByText("iot.calibration.detail.delete"));

    await vi.waitFor(() => {
      expect(remove.calls).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(router.push).not.toHaveBeenCalled();
  });
});
