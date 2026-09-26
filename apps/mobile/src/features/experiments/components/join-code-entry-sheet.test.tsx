import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TextInput } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JoinCodeEntrySheet } from "./join-code-entry-sheet";

interface EntryTestState {
  pushed: unknown[];
  scan?: (data: string) => void;
}

const state = vi.hoisted<EntryTestState>(() => ({ pushed: [], scan: undefined }));

vi.mock("expo-router", () => ({
  router: { push: (target: unknown) => state.pushed.push(target) },
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777", card: "#FFFFFF", onSurface: "#121212" }),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("@gorhom/bottom-sheet", async () => {
  const { TextInput: RNTextInput } = await import("react-native");
  return {
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    BottomSheetBackdrop: () => null,
    BottomSheetTextInput: RNTextInput,
  };
});
vi.mock("~/shared/ui/qr-scanner/qr-scanner-modal", () => ({
  QRScannerModal: ({ onScanned }: { onScanned: (data: string) => void }) => {
    state.scan = onScanned;
    return null;
  },
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common:cancel": "Cancel",
        "experiments:joinCode.enterTitle": "Enter your join code",
        "experiments:joinCode.enterHint": "Type the code your organizer gave you",
        "experiments:joinCode.label": "Join code",
        "experiments:joinCode.placeholder": "XXXX-XXXX",
        "experiments:joinCode.scan": "Scan QR",
        "experiments:joinCode.continue": "Continue",
        "experiments:joinCode.invalid": "Check the code and try again",
        "experiments:joinCode.invalidQr": "That QR isn't an openJII join code",
      })[key] ?? key,
  }),
}));

function codeField() {
  return screen.UNSAFE_getByType(TextInput);
}

beforeEach(() => {
  state.pushed = [];
  state.scan = undefined;
});

describe("JoinCodeEntrySheet", () => {
  it("groups the code as the student types, whatever case or spacing they use", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.changeText(codeField(), "kp7q 4wmx");

    expect((codeField().props as { value: string }).value).toBe("KP7Q-4WMX");
  });

  it("collapses a pasted landing URL to the code it carries", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.changeText(codeField(), "https://openjii.org/en-US/join/KP7Q-4WMX");

    expect((codeField().props as { value: string }).value).toBe("KP7Q-4WMX");
  });

  it("opens the join screen with the normalized code", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.changeText(codeField(), "kp7q-4wmx");
    fireEvent.press(screen.getByText("Continue"));

    expect(state.pushed).toEqual([{ pathname: "/join/[code]", params: { code: "KP7Q4WMX" } }]);
  });

  it("shows an inline error and navigates nowhere for an incomplete code", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.changeText(codeField(), "kp7q4wm");
    fireEvent.press(screen.getByText("Continue"));

    expect(state.pushed).toEqual([]);
    expect(screen.getByText("Check the code and try again")).toBeTruthy();
  });

  it("clears the inline error as soon as the student edits the code again", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.changeText(codeField(), "kp7q4wm");
    fireEvent.press(screen.getByText("Continue"));
    fireEvent.changeText(codeField(), "kp7q4wmx");

    expect(screen.queryByText("Check the code and try again")).toBeNull();
  });

  it("opens the join screen from a scanned landing URL", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.press(screen.getByText("Scan QR"));
    act(() => state.scan?.("https://openjii.org/en-US/join/KP7Q-4WMX"));

    expect(state.pushed).toEqual([{ pathname: "/join/[code]", params: { code: "KP7Q4WMX" } }]);
  });

  it("says so when the scanned QR belongs to something else entirely", () => {
    render(<JoinCodeEntrySheet />);

    fireEvent.press(screen.getByText("Scan QR"));
    act(() => state.scan?.("https://example.com/some-other-qr"));

    expect(state.pushed).toEqual([]);
    expect(screen.getByText("That QR isn't an openJII join code")).toBeTruthy();
  });
});
