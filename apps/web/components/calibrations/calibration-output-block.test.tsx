import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WritableCoefficient } from "@repo/iot";

import { CalibrationOutputBlock } from "./calibration-output-block";

const WRITABLE: WritableCoefficient[] = [
  { name: "slope", isArray: false },
  { name: "channels", isArray: true, length: 6 },
];

function renderBlock(props: Partial<Parameters<typeof CalibrationOutputBlock>[0]> = {}) {
  const handlers = {
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onSetCoefficient: vi.fn(),
    onRenameCoefficient: vi.fn(),
    onRemoveCoefficient: vi.fn(),
  };
  render(
    <CalibrationOutputBlock
      block="par"
      coefficients={{ slope: { type: "number" } }}
      writable={WRITABLE}
      takenBlocks={["par"]}
      canEdit
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("CalibrationOutputBlock", () => {
  it("renames the block a device is written in", async () => {
    const { onRename } = renderBlock();

    const field = screen.getByLabelText("iot.calibration.produces.block");
    await userEvent.clear(field);
    await userEvent.type(field, "spec");

    expect(onRename).toHaveBeenLastCalledWith("spec");
  });

  it("refuses a block name the schema already holds, and puts the saved one back", async () => {
    const { onRename } = renderBlock({ takenBlocks: ["par", "led"] });

    const field = screen.getByLabelText("iot.calibration.produces.block");
    await userEvent.clear(field);
    await userEvent.type(field, "led");
    expect(screen.getByText("iot.calibration.produces.blockTaken")).toBeInTheDocument();

    await userEvent.tab();
    expect(field).toHaveValue("par");
    expect(onRename).not.toHaveBeenCalledWith("led");
  });

  it("refuses a block name the fit script could not address", async () => {
    const { onRename } = renderBlock();

    const field = screen.getByLabelText("iot.calibration.produces.block");
    await userEvent.clear(field);
    await userEvent.type(field, "1par");

    expect(screen.getByText("iot.calibration.produces.nameInvalid")).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalledWith("1par");
  });

  // A per-channel coefficient declared as a number fails validation on the first real fit,
  // so taking the shape from the writer is what keeps the author out of that.
  it("adds a writable coefficient in the shape its writer declares", async () => {
    const { onSetCoefficient } = renderBlock();

    await userEvent.click(
      screen.getByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "channels" }));

    expect(onSetCoefficient).toHaveBeenCalledWith("channels", {
      type: "number_array",
      length: 6,
    });
  });

  it("offers a plain coefficient under a name nothing else holds", async () => {
    const { onSetCoefficient } = renderBlock({
      coefficients: { slope: { type: "number" }, coefficient: { type: "number" } },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "iot.calibration.produces.addPlain" }),
    );

    expect(onSetCoefficient).toHaveBeenCalledWith("coefficient_2", { type: "number" });
  });

  it("stops offering a writable name the block already declares", async () => {
    renderBlock();

    await userEvent.click(
      screen.getByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    );

    expect(screen.queryByRole("menuitem", { name: "slope" })).toBeNull();
  });

  it("offers nothing to change on a definition a run has closed", () => {
    renderBlock({ canEdit: false });

    expect(screen.getByLabelText("iot.calibration.produces.block")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    ).toBeNull();
  });
});
