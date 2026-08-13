import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeviceSelectableExperimentRow } from "./device-selectable-experiment-row";

const experiment = createExperiment({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Fresh",
});

describe("DeviceSelectableExperimentRow", () => {
  it("reports a selection through onToggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ul>
        <DeviceSelectableExperimentRow
          experiment={experiment}
          isSelected={false}
          onToggle={onToggle}
        />
      </ul>,
    );

    await user.click(screen.getByLabelText("Fresh"));

    expect(onToggle).toHaveBeenCalledWith(experiment.id, true);
  });

  it("reports a deselection when already selected", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ul>
        <DeviceSelectableExperimentRow experiment={experiment} isSelected onToggle={onToggle} />
      </ul>,
    );

    expect(screen.getByRole("checkbox")).toBeChecked();

    await user.click(screen.getByLabelText("Fresh"));

    expect(onToggle).toHaveBeenCalledWith(experiment.id, false);
  });
});
