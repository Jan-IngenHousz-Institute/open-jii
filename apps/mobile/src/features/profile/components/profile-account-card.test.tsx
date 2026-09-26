import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileAccountCard } from "./profile-account-card";

const push = vi.hoisted(() => vi.fn<(href: unknown) => void>());

vi.mock("expo-router", () => ({ router: { push: (href: unknown) => push(href) } }));
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: () => "https://app.example.org",
}));
vi.mock("~/shared/ui/AlertDialog", () => ({ showAlert: vi.fn() }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "profile:account.section": "Account",
        "profile:account.discover": "Find experiments and organizations",
        "profile:account.discoverSub": "Public experiments, organizations, or a join code",
        "profile:account.appSettings": "App settings",
        "profile:account.appSettingsSub": "Theme, units, offline mode",
        "profile:account.helpFeedback": "Help & feedback",
        "profile:openWebProfile": "Open web profile",
        "profile:account.openWebProfileSub": "View your researcher profile online",
      })[key] ?? key,
  }),
}));

const onOpenAppSettings = vi.hoisted(() => vi.fn<() => void>()) as Mock<() => void>;

beforeEach(() => {
  push.mockClear();
  onOpenAppSettings.mockClear();
});

describe("ProfileAccountCard", () => {
  it("offers one discovery row, not one per type", () => {
    render(<ProfileAccountCard onOpenAppSettings={onOpenAppSettings} />);

    expect(screen.getByText("Find experiments and organizations")).toBeTruthy();
    expect(screen.getByText("Public experiments, organizations, or a join code")).toBeTruthy();
    expect(screen.queryByText("Organizations")).toBeNull();
  });

  it("is the permanent way back to the hub, once the Home card is gone", () => {
    render(<ProfileAccountCard onOpenAppSettings={onOpenAppSettings} />);

    fireEvent.press(screen.getByText("Find experiments and organizations"));

    expect(push).toHaveBeenCalledWith("/discover");
  });

  it("leaves the other account rows alone", () => {
    render(<ProfileAccountCard onOpenAppSettings={onOpenAppSettings} />);

    fireEvent.press(screen.getByText("App settings"));

    expect(onOpenAppSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Help & feedback")).toBeTruthy();
    expect(screen.getByText("Open web profile")).toBeTruthy();
  });
});
