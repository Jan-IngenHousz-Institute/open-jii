import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import CalibrationDefinitionPage, { generateMetadata } from "./page";

vi.mock("@/components/calibrations/calibration-definition-detail", () => ({
  CalibrationDefinitionDetail: () => <section aria-label="definition" />,
}));

describe("generateMetadata", () => {
  it("titles the route from the calibration library", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en-US" }) });

    expect(metadata.title).toBe("iot.calibration.library.title");
  });
});

describe("CalibrationDefinitionPage", () => {
  // The layout already provides the page container; a second one would narrow the sidebar
  // and the editors to a reading column.
  it("renders the authoring surface with no container of its own", () => {
    const { container } = render(<CalibrationDefinitionPage />);

    expect(screen.getByRole("region", { name: "definition" })).toBeInTheDocument();
    expect(container.firstElementChild).toBe(screen.getByRole("region", { name: "definition" }));
  });
});
