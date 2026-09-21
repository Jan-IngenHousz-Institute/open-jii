import { describe, expect, it } from "vitest";

import { fitRecipe } from "./fit-recipe";
import type { ProducedSeries } from "./produced-series";

const PAR_SWEEP: ProducedSeries = {
  name: "par_sweep",
  columns: ["stimulus", "par_raw", "par_ref"],
  optional: false,
};

const LED_SWEEP: ProducedSeries = {
  name: "led_1",
  columns: ["stimulus", "counts"],
  optional: false,
};

describe("fitRecipe", () => {
  // Two readings taken at the same point are a device against a reference; the drive only
  // orders them. This is the shape the seeded MiniPAR bench fits.
  it("fits the second reading against the first, ordered by the drive", () => {
    const script = fitRecipe([PAR_SWEEP], {
      blocks: {
        par: { slope: { type: "number", min: 0.1, max: 10 }, intercept: { type: "number" } },
      },
    });

    expect(script).toContain("from qc import assess_linear_fit");
    expect(script).toContain('points = inputs["par_sweep"]');
    expect(script).toContain(
      '    points["par_raw"],\n    points["par_ref"],\n    points["stimulus"],',
    );
    expect(script).toContain("slope_min=0.1");
    expect(script).toContain("slope_max=10");
    expect(script).toContain('"slope": fit["slope"], "intercept": fit["intercept"]');
    expect(script).toContain("submit(blocks)");
  });

  // One reading is the drive against what it produced, which is how an LED is characterised.
  it("fits the one reading against the drive when that is all there is", () => {
    const script = fitRecipe([LED_SWEEP], {
      blocks: { led: { slope: { type: "number" }, intercept: { type: "number" } } },
    });

    expect(script).toContain('    points["stimulus"],\n    points["counts"],\n    slope_min=');
  });

  // A single coefficient is a gain, and the bench tools fit those through the origin.
  it("fits a lone coefficient through the origin", () => {
    const script = fitRecipe([PAR_SWEEP], {
      blocks: { par: { spec: { type: "number", min: 0.05, max: 100 } } },
    });

    expect(script).toContain("from qc import assess_origin_fit");
    expect(script).toContain("coefficient_min=0.05");
    expect(script).toContain('"spec": fit["coefficient"]');
  });

  // The gates are the point of the helper. A bound the author has not declared is left
  // open rather than filled with a number nobody chose.
  it("leaves an undeclared bound open and says so", () => {
    const script = fitRecipe([PAR_SWEEP], {
      blocks: { par: { slope: { type: "number" }, intercept: { type: "number" } } },
    });

    expect(script).toContain("slope_min=-math.inf");
    expect(script).toContain("slope_max=math.inf");
    expect(script).toContain("# slope is ungated");
  });

  it("records the pairs the line was drawn through, so the run charts its own fit", () => {
    const script = fitRecipe([PAR_SWEEP], {
      blocks: { par: { spec: { type: "number" } } },
    });

    expect(script).toContain('"x": "par_raw"');
    expect(script).toContain(
      '"points": [[x, y] for x, y in zip(points["par_raw"], points["par_ref"])]',
    );
  });

  // Guessing at a per-channel fit produces a script that runs and is wrong, which costs
  // more than one that says plainly it did not write this part.
  it("leaves a block it cannot fit to the author, with the reason in the block", () => {
    const script = fitRecipe([PAR_SWEEP], {
      blocks: {
        par: { spec: { type: "number" } },
        baseline: { channels: { type: "integer_array", length: 6 } },
      },
    });

    expect(script).toContain("no capture series left to fit this block from");
    expect(script).toContain('"status": "skipped"');
  });

  it("says so when a block holds a coefficient per channel", () => {
    const script = fitRecipe([PAR_SWEEP], {
      blocks: { baseline: { channels: { type: "integer_array", length: 6 } } },
    });

    expect(script).toContain("per-channel coefficient");
    expect(script).not.toContain("from qc import");
  });

  it("fits each block from the series recorded in the same place", () => {
    const script = fitRecipe([PAR_SWEEP, LED_SWEEP], {
      blocks: {
        par: { spec: { type: "number" } },
        led: { act: { type: "number" } },
      },
    });

    expect(script).toContain('points = inputs["par_sweep"]');
    expect(script).toContain('points = inputs["led_1"]');
    expect(script).toContain('blocks["par"]');
    expect(script).toContain('blocks["led"]');
  });
});
