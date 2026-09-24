import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationStepActions } from "./calibration-step-actions";

function renderActions(props: Partial<Parameters<typeof CalibrationStepActions>[0]> = {}) {
  const handlers = {
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onToggleOptional: vi.fn(),
    onAskFirst: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <CalibrationStepActions
      position={2}
      canMoveUp
      canMoveDown
      isSkippable
      isOptional={false}
      canAskFirst={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "iot.calibration.procedure.menu.label" }));
}

describe("CalibrationStepActions", () => {
  // One tab stop for the whole row, with the menu walked by the arrow keys.
  it("opens from the keyboard and moves the step", async () => {
    const { onMoveDown, user } = renderActions();

    await user.tab();
    expect(
      screen.getByRole("button", { name: "iot.calibration.procedure.menu.label" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("menuitem", { name: "iot.calibration.procedure.menu.moveDown" }),
    );

    expect(onMoveDown).toHaveBeenCalled();
  });

  it("will not move the first step further up", async () => {
    const { user } = renderActions({ canMoveUp: false });

    await openMenu(user);

    expect(
      await screen.findByRole("menuitem", { name: "iot.calibration.procedure.menu.moveUp" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("marks the step skippable, and shows when it already is", async () => {
    const { onToggleOptional, user } = renderActions({ isOptional: true });

    await openMenu(user);
    const skip = await screen.findByRole("menuitemcheckbox", {
      name: "iot.calibration.procedure.maySkip",
    });
    expect(skip).toHaveAttribute("aria-checked", "true");
    await user.click(skip);

    expect(onToggleOptional).toHaveBeenCalled();
  });

  it("offers no skip on a step the run cannot do without", async () => {
    const { user } = renderActions({ isSkippable: false });

    await openMenu(user);

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
  });

  it("offers to ask the operator first only where there is no instruction yet", async () => {
    const { onAskFirst, user } = renderActions({ canAskFirst: true });

    await openMenu(user);
    await user.click(
      await screen.findByRole("menuitem", { name: "iot.calibration.procedure.menu.askFirst" }),
    );

    expect(onAskFirst).toHaveBeenCalled();
  });

  it("removes the step", async () => {
    const { onRemove, user } = renderActions();

    await openMenu(user);
    await user.click(
      await screen.findByRole("menuitem", { name: "iot.calibration.procedure.menu.remove" }),
    );

    expect(onRemove).toHaveBeenCalled();
  });
});
