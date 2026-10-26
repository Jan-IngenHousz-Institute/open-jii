import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import {
  countStudyDescriptors,
  ExperimentStandardsReadiness,
} from "./experiment-standards-readiness";

const goldenExperiment = createExperiment({
  startDate: "2026-06-01",
  endDate: "2026-08-30",
  organism: "Zea mays",
  experimentalDesign: "RCBD",
  growthFacility: "Open field",
  license: "CC-BY-4.0",
});

describe("countStudyDescriptors", () => {
  it("counts 0 for a sparse experiment and all for a golden one", () => {
    const sparse = countStudyDescriptors(createExperiment());
    expect(sparse.filled).toBe(0);

    const golden = countStudyDescriptors(goldenExperiment);
    expect(golden.filled).toBe(golden.total);
  });

  it("counts partial fills", () => {
    expect(
      countStudyDescriptors(createExperiment({ organism: "Zea mays", license: "CC0-1.0" })).filled,
    ).toBe(2);
  });
});

describe("<ExperimentStandardsReadiness />", () => {
  it("shows the license when chosen", () => {
    render(<ExperimentStandardsReadiness experiment={goldenExperiment} />);
    expect(screen.getByText("standardsReadiness.title")).toBeInTheDocument();
    expect(screen.getByText(/studyDetails\.licenseCcByShort/)).toBeInTheDocument();
  });

  it("shows the none state without a license", () => {
    render(<ExperimentStandardsReadiness experiment={createExperiment()} />);
    expect(screen.getByText(/standardsReadiness\.licenseNone/)).toBeInTheDocument();
  });
});
