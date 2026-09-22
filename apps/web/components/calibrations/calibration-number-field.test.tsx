import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationNumberField } from "./calibration-number-field";

function renderField(props: Partial<Parameters<typeof CalibrationNumberField>[0]> = {}) {
  const onCommit = vi.fn();
  render(
    <CalibrationNumberField label="Settle" value={1} onCommit={onCommit} canEdit {...props} />,
  );
  return { onCommit, field: screen.getByLabelText("Settle") };
}

describe("CalibrationNumberField", () => {
  it("commits a number the author typed", async () => {
    const { onCommit, field } = renderField({ value: undefined });

    await userEvent.type(field, "2.5");

    expect(onCommit).toHaveBeenLastCalledWith(2.5);
  });

  // Committing "-" or "1e" would put a document the contract refuses in front of the author.
  it("keeps a half-typed number on screen without committing it", async () => {
    const { onCommit, field } = renderField({ value: undefined });

    await userEvent.type(field, "-");

    expect(field).toHaveValue("-");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("refuses a value outside the instrument's range", async () => {
    const { onCommit, field } = renderField({ value: undefined, min: 0, max: 5 });

    await userEvent.type(field, "9");

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("refuses a fraction where only whole units make sense", async () => {
    const { onCommit, field } = renderField({ value: undefined, integer: true });

    await userEvent.type(field, "2.5");

    expect(onCommit).not.toHaveBeenCalledWith(2.5);
  });

  it("clears an optional value rather than holding the last number", async () => {
    const { onCommit, field } = renderField({ value: 3, clearable: true });

    await userEvent.clear(field);

    expect(onCommit).toHaveBeenLastCalledWith(undefined);
  });

  it("holds a required value rather than committing an empty one", async () => {
    const { onCommit, field } = renderField({ value: 3 });

    await userEvent.clear(field);

    expect(onCommit).not.toHaveBeenCalled();
  });

  // A type switch or a step moving rewrites the value under the author's cursor.
  it("takes a value changed elsewhere over what was being typed", async () => {
    const { rerender } = render(
      <CalibrationNumberField label="Settle" value={1} onCommit={vi.fn()} canEdit />,
    );
    await userEvent.type(screen.getByLabelText("Settle"), "7");

    rerender(<CalibrationNumberField label="Settle" value={4} onCommit={vi.fn()} canEdit />);

    expect(screen.getByLabelText("Settle")).toHaveValue("4");
  });

  it("locks on a definition that can no longer be edited", () => {
    const { field } = renderField({ canEdit: false });

    expect(field).toBeDisabled();
  });
});
