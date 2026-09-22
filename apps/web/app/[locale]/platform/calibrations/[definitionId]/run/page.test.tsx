import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import CalibrationRunPage, { generateMetadata } from "./page";

vi.mock("@/components/calibrations/calibration-run-content", () => ({
  CalibrationRunContent: () => <section aria-label="bench" />,
}));

describe("generateMetadata", () => {
  it("titles the route by the bench session it opens", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en-US" }) });

    expect(metadata.title).toBe("iot.calibration.trial.title");
  });
});

describe("CalibrationRunPage", () => {
  it("renders the bench", () => {
    render(<CalibrationRunPage />);

    expect(screen.getByRole("region", { name: "bench" })).toBeInTheDocument();
  });
});
