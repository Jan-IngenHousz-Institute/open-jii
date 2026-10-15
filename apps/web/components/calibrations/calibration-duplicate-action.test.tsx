import {
  AutosaveStatusProvider,
  useReportAutosaveStatus,
} from "@/components/shared/autosave/autosave-status-context";
import {
  createCalibrationDefinition,
  createCalibrationDefinitionDetail,
  createCalibrationDefinitionSummary,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { CalibrationDuplicateAction } from "./calibration-duplicate-action";

/** Stands in for the definition page while an edit waits on its autosave. */
function UnsavedEdit() {
  useReportAutosaveStatus({ status: "dirty", error: null });
  return null;
}

const definition = createCalibrationDefinitionDetail({
  name: "PAR bench",
  family: "minipar",
  description: "Three light levels and darkness",
  runCount: 4,
});

describe("CalibrationDuplicateAction", () => {
  // Five coupled artefacts carry over, or the copy is a blank the author retypes.
  it("creates a copy carrying the whole definition, under a free name", async () => {
    const created = createCalibrationDefinition({ name: "PAR bench (copy)" });
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary({ name: "PAR bench" })],
    });
    const spy = server.mount(contract.iot.createCalibrationDefinition, { body: created });

    render(<CalibrationDuplicateAction definition={definition} />);
    await userEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    await waitFor(() => {
      expect(spy.body).toMatchObject({
        name: "PAR bench (copy)",
        family: "minipar",
        description: "Three light levels and darkness",
        captureProcedure: definition.captureProcedure,
        script: definition.script,
        outputSchema: definition.outputSchema,
      });
    });

    const router = useRouter();
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(`/en-US/platform/calibrations/${created.id}`);
    });
  });

  // One name is one calibration, so a second copy cannot reuse the first one's name.
  it("numbers the copy when the plain name is taken", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, {
      body: [
        createCalibrationDefinitionSummary({ name: "PAR bench" }),
        createCalibrationDefinitionSummary({ name: "PAR bench (copy)" }),
      ],
    });
    const spy = server.mount(contract.iot.createCalibrationDefinition, {
      body: createCalibrationDefinition(),
    });

    render(<CalibrationDuplicateAction definition={definition} />);
    await screen.findByRole("button", { name: /duplicate/i });
    await userEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "PAR bench (copy) 2" });
    });
  });

  // The button sits on every definition page; the list is only worth fetching to name a copy.
  it("fetches the names in use only when asked to copy", async () => {
    const list = server.mount(contract.iot.listCalibrationDefinitions, { body: [] });
    server.mount(contract.iot.createCalibrationDefinition, {
      body: createCalibrationDefinition(),
    });

    render(<CalibrationDuplicateAction definition={definition} />);
    await screen.findByRole("button", { name: /duplicate/i });
    expect(list.called).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    await waitFor(() => {
      expect(list.called).toBe(true);
    });
  });

  // The copy is made from what is saved, so an edit still waiting on autosave would be lost.
  it("waits for an unsaved edit before it can copy", () => {
    render(
      <AutosaveStatusProvider>
        <UnsavedEdit />
        <CalibrationDuplicateAction definition={definition} />
      </AutosaveStatusProvider>,
    );

    expect(screen.getByRole("button", { name: /duplicate/i })).toBeDisabled();
  });
});
