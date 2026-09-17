import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  CalibrationFamily,
  CalibrationOutputSchema,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { CalibrationOutputSchemaEditor } from "./calibration-output-schema-editor";

const schema: CalibrationOutputSchema = {
  blocks: { par: { slope: { type: "number" } } },
};

/** The page holds the document and hands it back, so an edit has to round-trip to show. */
function Host({
  family,
  initial,
  onChange,
}: {
  family: CalibrationFamily;
  initial: CalibrationOutputSchema;
  onChange: (next: CalibrationOutputSchema) => void;
}) {
  const [edited, setEdited] = useState(initial);

  return (
    <CalibrationOutputSchemaEditor
      family={family}
      outputSchema={edited}
      canEdit
      onChange={(next) => {
        setEdited(next);
        onChange(next);
      }}
    />
  );
}

function renderEditor(initial = schema, family: CalibrationFamily = "minipar") {
  const onChange = vi.fn<(next: CalibrationOutputSchema) => void>();
  render(<Host family={family} initial={initial} onChange={onChange} />);
  return { onChange, user: userEvent.setup({ pointerEventsCheck: 0 }) };
}

function rowFor(name: string) {
  const row = screen
    .getAllByRole("listitem")
    .find((candidate) => within(candidate).queryByDisplayValue(name) !== null);
  if (!row) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

describe("CalibrationOutputSchemaEditor", () => {
  // The coupling that otherwise fails silently: a block no writer covers is captured,
  // fitted, approved, and then never reaches the device.
  it("warns about a coefficient the platform has no command for", () => {
    renderEditor({ blocks: { par: { slope: { type: "number" }, gain: { type: "number" } } } });

    expect(screen.getByText(/iot.calibration.detail.notWritable/)).toBeInTheDocument();
    expect(within(rowFor("gain")).getByText("iot.calibration.produces.recordedOnly")).toBeVisible();
  });

  it("says nothing when every coefficient can be written", () => {
    renderEditor({
      blocks: { par: { slope: { type: "number" }, intercept: { type: "number" } } },
    });

    expect(screen.queryByText(/iot.calibration.detail.notWritable/)).toBeNull();
  });

  // A family with no writers at all is legitimate: the run is recorded, nothing is sent.
  it("warns for a family the platform cannot write at all", () => {
    renderEditor({ blocks: { led1: { slope: { type: "number" } } } }, "multispeq");

    expect(screen.getByText(/iot.calibration.detail.notWritable/)).toBeInTheDocument();
  });

  // Nothing is typed that the registry already knows, and a per-channel coefficient
  // declared as a plain number fails on the first real fit.
  it("adds a block the family can be written with, carrying its coefficients", async () => {
    const { onChange, user } = renderEditor();

    await user.click(screen.getByRole("button", { name: /iot.calibration.produces.addBlock/ }));
    await user.click(await screen.findByRole("menuitem", { name: "spec" }));

    const added = onChange.mock.calls[0][0];
    expect(added.blocks.spec).toEqual({
      channel_coefficients: { type: "number_array", length: 10 },
    });
  });

  it("offers the coefficients this block is missing", async () => {
    const { onChange, user } = renderEditor();

    await user.click(
      screen.getByRole("button", { name: /iot.calibration.produces.addCoefficient/ }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "intercept" }));

    expect(onChange.mock.calls[0][0].blocks.par).toEqual({
      slope: { type: "number" },
      intercept: { type: "number" },
    });
  });

  it("renames a coefficient without losing what it holds", async () => {
    const { onChange, user } = renderEditor({
      blocks: { par: { slope: { type: "number", min: 0.1, max: 10 } } },
    });

    await user.type(within(rowFor("slope")).getByDisplayValue("slope"), "_a");

    const renamed = onChange.mock.calls.at(-1)?.[0];
    expect(renamed?.blocks.par.slope_a).toEqual({ type: "number", min: 0.1, max: 10 });
  });

  it("keeps a bound the author is still typing out of the document", async () => {
    const { onChange, user } = renderEditor();

    const min = within(rowFor("slope")).getByLabelText("iot.calibration.produces.min");
    await user.type(min, "-");

    expect(min).toHaveValue("-");
    expect(onChange).not.toHaveBeenCalled();

    await user.type(min, "2.5");
    expect(onChange.mock.calls.at(-1)?.[0].blocks.par.slope).toEqual({ type: "number", min: -2.5 });
  });

  it("asks how many entries an array holds once one is declared", async () => {
    const { onChange, user } = renderEditor();
    const row = rowFor("slope");

    await user.click(within(row).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "number_array" }));

    expect(onChange.mock.calls[0][0].blocks.par.slope).toEqual({
      type: "number_array",
      length: 10,
    });
    expect(within(rowFor("slope")).getByLabelText("iot.calibration.produces.length")).toHaveValue(
      "10",
    );
  });

  it("removes a coefficient", async () => {
    const { onChange, user } = renderEditor({
      blocks: { par: { slope: { type: "number" }, intercept: { type: "number" } } },
    });

    await user.click(
      within(rowFor("slope")).getByRole("button", {
        name: "iot.calibration.produces.removeCoefficient",
      }),
    );

    expect(Object.keys(onChange.mock.calls[0][0].blocks.par)).toEqual(["intercept"]);
  });
});
