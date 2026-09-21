import { render, screen } from "@testing-library/react-native";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { UploadFailureNote } from "./upload-failure-note";

// The note's whole job is choosing a key, so the mock returns the key itself.
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("UploadFailureNote", () => {
  it("asks for a fresh sign-in after a credential failure", () => {
    render(<UploadFailureNote reason="CredentialError" />);

    expect(screen.getByText("recentMeasurements:failureReason.credentials")).toBeTruthy();
  });

  it("reads every transport-level kind as a connection problem", () => {
    render(<UploadFailureNote reason="Timeout" />);

    expect(screen.getByText("recentMeasurements:failureReason.connection")).toBeTruthy();
  });

  it("says the experiment is out of reach when membership is refused", () => {
    render(<UploadFailureNote reason="Forbidden" />);

    expect(screen.getByText("recentMeasurements:failureReason.permission")).toBeTruthy();
  });

  it("says the server refused the measurement when S3 rejects it", () => {
    render(<UploadFailureNote reason="Rejected" />);

    expect(screen.getByText("recentMeasurements:failureReason.rejected")).toBeTruthy();
  });

  it("falls back to the generic line for a row that stored no reason", () => {
    render(<UploadFailureNote reason={null} />);

    expect(screen.getByText("recentMeasurements:failureReason.unknown")).toBeTruthy();
  });

  it("falls back to the generic line for a kind it does not know", () => {
    render(<UploadFailureNote reason="SomethingNew" />);

    expect(screen.getByText("recentMeasurements:failureReason.unknown")).toBeTruthy();
  });
});
