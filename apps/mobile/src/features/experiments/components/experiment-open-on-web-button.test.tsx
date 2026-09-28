import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";
import type { MockInstance } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentOpenOnWebButton } from "./experiment-open-on-web-button";

const { mockShowAlert } = vi.hoisted(() => ({ mockShowAlert: vi.fn() }));

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://app.openjii.test",
}));
vi.mock("~/shared/ui/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => mockShowAlert(...args),
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777", onSurface: "#121212" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common:errorTitle": "Error",
        "experiments:detail.openWeb": "Open on web platform",
        "experiments:detail.openWebUnavailable": "Couldn't open the web platform.",
      })[key] ?? key,
  }),
}));

const EXPERIMENT_ID = "00000000-0000-4000-8000-000000000001";
const EXPECTED_URL = `https://app.openjii.test/en-US/platform/experiments/${EXPERIMENT_ID}`;

let canOpenURL: MockInstance<typeof Linking.canOpenURL>;
let openURL: MockInstance<typeof Linking.openURL>;

beforeEach(() => {
  vi.restoreAllMocks();
  mockShowAlert.mockClear();
  canOpenURL = vi.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
  openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(true);
  canOpenURL.mockClear();
  openURL.mockClear();
});

describe("ExperimentOpenOnWebButton", () => {
  it("opens the experiment's page on the web platform", async () => {
    render(<ExperimentOpenOnWebButton experimentId={EXPERIMENT_ID} />);

    fireEvent.press(screen.getByLabelText("Open on web platform"));

    await vi.waitFor(() => expect(openURL).toHaveBeenCalledWith(EXPECTED_URL));
    expect(canOpenURL).toHaveBeenCalledWith(EXPECTED_URL);
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("explains itself rather than failing silently when nothing can open the link", async () => {
    canOpenURL.mockResolvedValue(false);

    render(<ExperimentOpenOnWebButton experimentId={EXPERIMENT_ID} />);

    fireEvent.press(screen.getByLabelText("Open on web platform"));

    await vi.waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith("Error", "Couldn't open the web platform."),
    );
    expect(openURL).not.toHaveBeenCalled();
  });

  it("explains itself when opening the link rejects rather than returning false", async () => {
    openURL.mockRejectedValue(new Error("no activity found"));

    render(<ExperimentOpenOnWebButton experimentId={EXPERIMENT_ID} />);

    fireEvent.press(screen.getByLabelText("Open on web platform"));

    await vi.waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith("Error", "Couldn't open the web platform."),
    );
  });

  it("carries an accessible label, since it renders as a bare icon", () => {
    render(<ExperimentOpenOnWebButton experimentId={EXPERIMENT_ID} />);

    expect(screen.getByLabelText("Open on web platform")).toBeTruthy();
  });
});
