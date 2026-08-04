import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DeviceBoundExperimentRow } from "./device-bound-experiment-row";

const experiment = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Corn Photosynthesis",
  status: "active" as const,
  addedAt: new Date().toISOString(),
};

describe("DeviceBoundExperimentRow", () => {
  it("shows the experiment name and its status badge", () => {
    render(
      <ul>
        <DeviceBoundExperimentRow experiment={experiment} />
      </ul>,
    );

    expect(screen.getByText("Corn Photosynthesis")).toBeInTheDocument();
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("labels an archived binding as archived", () => {
    render(
      <ul>
        <DeviceBoundExperimentRow experiment={{ ...experiment, status: "archived" }} />
      </ul>,
    );

    expect(screen.getByText("status.archived")).toBeInTheDocument();
  });
});
