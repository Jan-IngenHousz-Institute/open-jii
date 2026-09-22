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
  return { ...handlers, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

/** A value reads as text until it is clicked, so a test reaches one the way a person does. */
async function openToken(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: label }));
  return screen.getByRole("textbox", { name: label });
}

describe("CalibrationOutputBlock", () => {
  // The block is named where it is read, on the coefficients it holds, rather than in a
  // header of its own.
  it("renames the block from the name a coefficient carries", async () => {
    const { onRename, user } = renderBlock();

    const block = await openToken(user, "iot.calibration.produces.block");
    await user.clear(block);
    await user.type(block, "spec");
    await user.tab();

    expect(onRename).toHaveBeenLastCalledWith("spec");
  });

  it("refuses a block name the schema already holds, and puts the saved one back", async () => {
    const { onRename, user } = renderBlock({ takenBlocks: ["par", "led"] });

    const block = await openToken(user, "iot.calibration.produces.block");
    await user.clear(block);
    await user.type(block, "led");
    await user.tab();

    expect(onRename).toHaveBeenLastCalledWith("led");
    expect(
      screen.getByRole("button", { name: "iot.calibration.produces.block" }),
    ).toHaveTextContent("par");
  });

  // A per-channel coefficient declared as a number fails validation on the first real fit,
  // so taking the shape from the writer is what keeps the author out of that.
  it("adds a writable coefficient in the shape its writer declares", async () => {
    const { onSetCoefficient, user } = renderBlock();

    await user.click(
      screen.getByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "channels" }));

    expect(onSetCoefficient).toHaveBeenCalledWith("channels", {
      type: "number_array",
      length: 6,
    });
  });

  it("offers a plain coefficient under a name nothing else holds", async () => {
    const { onSetCoefficient, user } = renderBlock({
      coefficients: { slope: { type: "number" }, coefficient: { type: "number" } },
    });

    await user.click(
      screen.getByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "iot.calibration.produces.addPlain" }),
    );

    expect(onSetCoefficient).toHaveBeenCalledWith("coefficient_2", { type: "number" });
  });

  it("stops offering a writable name the block already declares", async () => {
    const { user } = renderBlock();

    await user.click(
      screen.getByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    );

    expect(screen.queryByRole("menuitem", { name: "slope" })).toBeNull();
  });

  it("says a coefficient is only recorded when no writer covers it", () => {
    renderBlock({ coefficients: { drift: { type: "number" } } });

    expect(screen.getByText("iot.calibration.produces.recordedOnly")).toBeInTheDocument();
  });

  it("offers nothing to change on a definition a run has closed", () => {
    renderBlock({ canEdit: false });

    expect(
      screen.queryByRole("button", { name: "iot.calibration.produces.addCoefficient" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "iot.calibration.produces.block" })).toBeNull();
  });
});
