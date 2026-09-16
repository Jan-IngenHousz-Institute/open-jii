import { render } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JoinRequestSheet } from "./join-request-sheet";

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
vi.mock("~/features/organizations/hooks/use-request-join-organization", () => ({
  useRequestJoinOrganization: () => ({
    requestJoin: state.requestJoin,
    isPending: state.isPending,
  }),
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777", card: "#FFFFFF" }),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("@gorhom/bottom-sheet", async () => {
  const { TextInput } = await import("react-native");
  return {
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    BottomSheetBackdrop: () => null,
    BottomSheetTextInput: TextInput,
  };
});
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common:cancel": "Cancel",
        "organizations:join.send": "Send request",
        "organizations:join.sending": "Sending…",
        "organizations:join.sheetTitle": "Request to join",
        "organizations:join.sheetHint": "Optional message",
        "organizations:join.messagePlaceholder": "Tell them who you are",
        "organizations:join.messageCounter": "0 / 250",
        "organizations:join.offlineHint": "You're offline. Reconnect to send this.",
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
  return render(<JoinRequestSheet organizationId="org-1" organizationName="Photosynthesis Lab" />);
}

beforeEach(() => {
  state.online = true;
  state.isPending = false;
  state.requestJoin.mockReset();
});

describe("JoinRequestSheet", () => {
  it("offers Send while online, with no offline hint", () => {
    const { UNSAFE_queryAllByType, queryByText } = renderSheet();

    expect(buttonStates(UNSAFE_queryAllByType).send).toBe(false);
    expect(queryByText("You're offline. Reconnect to send this.")).toBeNull();
  });

  it("disables Send and explains why when connectivity drops with the sheet open", () => {
    state.online = false;

    const { UNSAFE_queryAllByType, getByText } = renderSheet();

    expect(buttonStates(UNSAFE_queryAllByType).send).toBe(true);
    expect(getByText("You're offline. Reconnect to send this.")).toBeTruthy();
  });

  it("keeps Cancel usable while offline, so the sheet is never a dead end", () => {
    state.online = false;

    const { UNSAFE_queryAllByType } = renderSheet();

    expect(buttonStates(UNSAFE_queryAllByType).cancel).toBe(false);
  });

  it("stays enabled on the first render, before connectivity is known", () => {
    state.online = undefined;

    const { UNSAFE_queryAllByType, queryByText } = renderSheet();

    expect(buttonStates(UNSAFE_queryAllByType).send).toBe(false);
    expect(queryByText("You're offline. Reconnect to send this.")).toBeNull();
  });

  it("disables both buttons while a request is in flight", () => {
    state.isPending = true;

    const { UNSAFE_queryAllByType } = renderSheet();
    const { send, cancel } = buttonStates(UNSAFE_queryAllByType);

    expect(send).toBe(true);
    expect(cancel).toBe(true);
  });
});
