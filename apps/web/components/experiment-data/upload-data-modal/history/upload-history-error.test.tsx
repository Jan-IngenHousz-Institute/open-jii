import { render, screen } from "@/test/test-utils";
import { ORPCError } from "@orpc/client";
import { describe, expect, it, vi } from "vitest";

import { UploadHistoryError } from "./upload-history-error";

// The shared mock drops interpolation values, and the message is the point here.
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: "en-US" },
  }),
}));

describe("UploadHistoryError", () => {
  it("passes on the message the API gave", () => {
    render(
      <UploadHistoryError
        error={new ORPCError("NOT_FOUND", { message: "Experiment not found" })}
      />,
    );

    expect(
      screen.getByText(
        'experimentData.uploadDataModal.history.error {"message":"Experiment not found"}',
      ),
    ).toBeInTheDocument();
  });

  it("falls back to an unknown error when the API gave no message", () => {
    render(<UploadHistoryError error={new Error("network down")} />);

    expect(
      screen.getByText(
        'experimentData.uploadDataModal.history.error {"message":"experimentData.uploadDataModal.history.unknownError"}',
      ),
    ).toBeInTheDocument();
  });
});
