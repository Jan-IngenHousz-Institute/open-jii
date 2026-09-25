import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JoinCodePreview } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

import { JoinCodeScreen } from "./join-code-screen";

interface ScreenState {
  rawCode: string;
  preview: JoinCodePreview | undefined;
  isLoading: boolean;
  isPaused: boolean;
  error: unknown;
  errorUpdatedAt: number;
  online: boolean | undefined;
  refetch: Mock<() => void>;
  redeem: Mock<
    (
      input: { code: string },
      callbacks?: { onSuccess?: (result: { experimentId: string }) => void },
    ) => void
  >;
  replaced: unknown[];
  presentedEntrySheet: Mock<() => void>;
}

const state = vi.hoisted<ScreenState>(() => ({
  rawCode: "KP7Q-4WMX",
  preview: undefined,
  isLoading: false,
  isPaused: false,
  error: undefined,
  errorUpdatedAt: 0,
  online: true,
  refetch: vi.fn<() => void>(),
  redeem: vi.fn(),
  replaced: [],
  presentedEntrySheet: vi.fn<() => void>(),
}));

vi.mock("expo-router", () => ({
  router: { replace: (target: unknown) => state.replaced.push(target) },
  useLocalSearchParams: () => ({ code: state.rawCode }),
  useNavigation: () => ({ setOptions: vi.fn() }),
}));
vi.mock("~/features/experiments/hooks/use-resolve-join-code", () => ({
  useResolveJoinCode: () => ({
    preview: state.preview,
    isLoading: state.isLoading,
    isPaused: state.isPaused,
    error: state.error,
    errorUpdatedAt: state.errorUpdatedAt,
    refetch: state.refetch,
  }),
}));
vi.mock("~/features/experiments/hooks/use-redeem-join-code", () => ({
  useRedeemJoinCode: () => ({ redeem: state.redeem, isPending: false }),
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({ useIsOnline: () => ({ data: state.online }) }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#777777", card: "#FFFFFF" }),
}));
vi.mock("~/features/experiments/components/join-code-entry-sheet", () => ({
  JoinCodeEntrySheet: React.forwardRef<{ present: () => void }>(
    function JoinCodeEntrySheet(_p, ref) {
      React.useImperativeHandle(ref, () => ({ present: state.presentedEntrySheet }));
      return null;
    },
  ),
}));
vi.mock("~/features/experiments/components/join-code-preview-card", () => ({
  JoinCodePreviewCard: ({
    code,
    onJoin,
    onOpen,
  }: {
    code: string;
    onJoin: () => void;
    onOpen: () => void;
  }) => (
    <View testID="preview">
      <Text testID="preview-code">{code}</Text>
      <Pressable testID="preview-join" onPress={onJoin} />
      <Pressable testID="preview-open" onPress={onOpen} />
    </View>
  ),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      ({
        "common:retry": "Retry",
        "experiments:joinCode.screenTitle": "Join experiment",
        "experiments:joinCode.notACode": "That's not a valid join code",
        "experiments:joinCode.enterDifferent": "Enter a different code",
        "experiments:joinCode.notFound": "This code isn't valid",
        "experiments:joinCode.expired": "This code has expired or was revoked",
        "experiments:joinCode.tryAnother": "Try another code",
        "experiments:joinCode.archived": "This experiment is archived",
        "experiments:joinCode.tooMany": "Too many attempts. You can try again now.",
        "experiments:joinCode.tooManyCountdown": `Too many attempts. Try again in ${String(options?.seconds)}s.`,
        "experiments:joinCode.offline": "You're offline. Connect to check this code.",
        "experiments:joinCode.loadFailed": "Could not check this code.",
      })[key] ?? key,
  }),
}));

function apiError(status: number, message = "", code?: string) {
  return Object.assign(new Error(message), { status, data: code ? { code } : undefined });
}

const PREVIEW: JoinCodePreview = {
  experiment: {
    id: "exp-1",
    name: "Canopy Phi2 Sweep",
    description: null,
    organizationName: "Canopy Lab",
    status: "active",
    hasWorkbook: true,
  },
  membershipStatus: "none",
  expiresAt: null,
};

beforeEach(() => {
  state.rawCode = "KP7Q-4WMX";
  state.preview = undefined;
  state.isLoading = false;
  state.isPaused = false;
  state.error = undefined;
  state.errorUpdatedAt = 0;
  state.online = true;
  state.replaced = [];
  state.refetch.mockClear();
  state.redeem.mockReset();
  state.presentedEntrySheet.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("JoinCodeScreen", () => {
  it("refuses a code that cannot be one, without asking the server", () => {
    state.rawCode = "not-a-code";

    render(<JoinCodeScreen />);

    expect(screen.getByText("That's not a valid join code")).toBeTruthy();
    fireEvent.press(screen.getByText("Enter a different code"));
    expect(state.presentedEntrySheet).toHaveBeenCalledOnce();
  });

  it("spins while the code is being resolved", () => {
    state.isLoading = true;

    const { UNSAFE_queryAllByType } = render(<JoinCodeScreen />);

    expect(UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it("says an expired or revoked code has expired, in its own words", () => {
    state.error = apiError(404, "server copy", "JOIN_CODE_EXPIRED");

    render(<JoinCodeScreen />);

    expect(screen.getByText("This code has expired or was revoked")).toBeTruthy();
    expect(screen.getByText("Try another code")).toBeTruthy();
  });

  it("says a code that never existed isn't valid", () => {
    state.error = apiError(404, "server copy", "JOIN_CODE_NOT_FOUND");

    render(<JoinCodeScreen />);

    expect(screen.getByText("This code isn't valid")).toBeTruthy();
  });

  it("never shows the server's English copy for a 404", () => {
    state.error = apiError(404, "This code has expired or was revoked");

    render(<JoinCodeScreen />);

    expect(screen.getByText("This code isn't valid")).toBeTruthy();
    expect(screen.queryByText("This code has expired or was revoked")).toBeNull();
  });

  it("explains a 403 as an archived experiment, and offers another code but no retry", () => {
    state.error = apiError(403);

    render(<JoinCodeScreen />);

    expect(screen.getByText("This experiment is archived")).toBeTruthy();
    // Resolving this code again can only fail the same way; a different code is
    // the only move left, so the entry sheet is the way out.
    expect(screen.queryByText("Retry")).toBeNull();

    fireEvent.press(screen.getByText("Try another code"));
    expect(state.presentedEntrySheet).toHaveBeenCalledOnce();
  });

  it("puts a throttled caller on the countdown, retrying the same code once it ends", () => {
    vi.useFakeTimers();
    state.error = apiError(429);
    state.errorUpdatedAt = Date.now();

    render(<JoinCodeScreen />);

    expect(screen.getByText("Too many attempts. Try again in 60s.")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
    // The throttle counts the caller, not the code, so another code is refused
    // just the same; offering one would only burn the wait.
    expect(screen.queryByText("Try another code")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    fireEvent.press(screen.getByText("Retry"));
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it("shows the offline state with Retry on a paused cold load", () => {
    state.isPaused = true;

    render(<JoinCodeScreen />);

    expect(screen.getByText("You're offline. Connect to check this code.")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it("shows the generic failure with Retry for anything else", () => {
    state.error = apiError(500);

    render(<JoinCodeScreen />);

    expect(screen.getByText("Could not check this code.")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("previews the experiment with the normalized code", () => {
    state.preview = PREVIEW;
    state.rawCode = "kp7q 4wmx";

    render(<JoinCodeScreen />);

    expect(screen.getByTestId("preview-code").props.children).toBe("KP7Q4WMX");
  });

  it("redeems the code and lands on the experiment the server named", () => {
    state.preview = PREVIEW;

    render(<JoinCodeScreen />);
    fireEvent.press(screen.getByTestId("preview-join"));

    expect(state.redeem).toHaveBeenCalledWith({ code: "KP7Q4WMX" }, expect.anything());

    state.redeem.mock.calls[0]?.[1]?.onSuccess?.({ experimentId: "exp-7" });
    expect(state.replaced).toEqual([{ pathname: "/discover/[id]", params: { id: "exp-7" } }]);
  });

  it("opens the experiment without redeeming when the caller is already in it", () => {
    state.preview = { ...PREVIEW, membershipStatus: "member" };

    render(<JoinCodeScreen />);
    fireEvent.press(screen.getByTestId("preview-open"));

    expect(state.redeem).not.toHaveBeenCalled();
    expect(state.replaced).toEqual([{ pathname: "/discover/[id]", params: { id: "exp-1" } }]);
  });

  it("reads the code out of a deep link, so a scan lands on the preview", () => {
    state.preview = PREVIEW;
    state.rawCode = "https://openjii.org/en-US/join/KP7Q-4WMX";

    render(<JoinCodeScreen />);

    expect(screen.getByTestId("preview-code").props.children).toBe("KP7Q4WMX");
  });
});
