import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { TextInput, TouchableOpacity } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentJoinRequestSheet } from "./experiment-join-request-sheet";

interface SheetTestState {
  online: boolean | undefined;
  isPending: boolean;
  requestJoin: Mock<(input: unknown, callbacks?: { onSuccess?: () => void }) => void>;
}

const state = vi.hoisted<SheetTestState>(() => ({
  online: true,
  isPending: false,
  requestJoin: vi.fn<(input: unknown, callbacks?: { onSuccess?: () => void }) => void>(),
}));

vi.mock("~/shared/ui/hooks/use-is-online", () => ({ useIsOnline: () => ({ data: state.online }) }));
vi.mock("~/features/experiments/hooks/use-request-join-experiment", () => ({
  useRequestJoinExperiment: () => ({
    requestJoin: state.requestJoin,
    isPending: state.isPending,
  }),
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777", card: "#FFFFFF" }),
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
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common:cancel": "Cancel",
        "experiments:join.send": "Send request",
        "experiments:join.sending": "Sending…",
        "experiments:join.sheetTitle": "Request to join",
        "experiments:join.sheetHint": "Optional message",
        "experiments:join.messagePlaceholder": "Tell them who you are",
        "experiments:join.messageCounter": "0 / 250",
        "experiments:join.offlineHint": "You're offline. Reconnect to send this.",
      })[key] ?? key,
  }),
}));

/**
 * `fireEvent.press` still fires on a disabled touchable under this harness, so
 * the buttons' own `disabled` props are the only honest signal.
 */
function buttonStates(queryAllByType: (t: typeof TouchableOpacity) => { props: unknown }[]) {
  const touchables = queryAllByType(TouchableOpacity) as { props: { disabled?: boolean } }[];
  expect(touchables).toHaveLength(2);
  return { send: touchables[0]?.props.disabled, cancel: touchables[1]?.props.disabled };
}

function renderSheet() {
  return render(
    <ExperimentJoinRequestSheet experimentId="exp-1" experimentName="Canopy Phi2 Sweep" />,
  );
}

beforeEach(() => {
  state.online = true;
  state.isPending = false;
  state.requestJoin.mockReset();
});

describe("ExperimentJoinRequestSheet", () => {
  it("offers Send while online, with no offline hint", () => {
    const { UNSAFE_queryAllByType, queryByText } = renderSheet();

    expect(buttonStates(UNSAFE_queryAllByType).send).toBe(false);
    expect(queryByText("You're offline. Reconnect to send this.")).toBeNull();
  });

  it("disables Send but keeps Cancel usable when connectivity drops with the sheet open", () => {
    state.online = false;

    const { UNSAFE_queryAllByType, getByText } = renderSheet();

    const { send, cancel } = buttonStates(UNSAFE_queryAllByType);
    expect(send).toBe(true);
    expect(cancel).toBe(false);
    expect(getByText("You're offline. Reconnect to send this.")).toBeTruthy();
  });

  it("does not submit while offline, even if the press lands", () => {
    state.online = false;

    const { getByText } = renderSheet();
    fireEvent.press(getByText("Send request"));

    expect(state.requestJoin).not.toHaveBeenCalled();
  });

  it("sends no message when the box was never touched", () => {
    const { getByText } = renderSheet();

    fireEvent.press(getByText("Send request"));

    expect(state.requestJoin).toHaveBeenCalledWith(
      { id: "exp-1", message: undefined },
      expect.anything(),
    );
  });

  it("trims the message it sends", () => {
    const { UNSAFE_getByType, getByText } = renderSheet();

    fireEvent.changeText(UNSAFE_getByType(TextInput), "  Tuesday field workshop  ");
    fireEvent.press(getByText("Send request"));

    expect(state.requestJoin).toHaveBeenCalledWith(
      { id: "exp-1", message: "Tuesday field workshop" },
      expect.anything(),
    );
  });

  it("clears the box only once the request actually lands", () => {
    const { UNSAFE_getByType, getByText } = renderSheet();

    fireEvent.changeText(UNSAFE_getByType(TextInput), "Tuesday field workshop");
    fireEvent.press(getByText("Send request"));

    expect((UNSAFE_getByType(TextInput).props as { value: string }).value).toBe(
      "Tuesday field workshop",
    );

    act(() => state.requestJoin.mock.calls[0]?.[1]?.onSuccess?.());

    expect((UNSAFE_getByType(TextInput).props as { value: string }).value).toBe("");
  });

  it("locks both buttons while the request is in flight", () => {
    state.isPending = true;

    const { UNSAFE_queryAllByType } = renderSheet();

    expect(buttonStates(UNSAFE_queryAllByType)).toEqual({ send: true, cancel: true });
  });
});
