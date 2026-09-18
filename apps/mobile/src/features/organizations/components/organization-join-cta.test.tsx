import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationJoinCta } from "./organization-join-cta";

/**
 * `fireEvent.press` still calls `onPress` on a disabled TouchableOpacity under
 * this harness, so a simulated press proves nothing about the disabled state.
 * Read the prop the Button actually hands to the touchable instead.
 */
function onlyButtonIsDisabled(
  queryAllByType: (type: typeof TouchableOpacity) => { props: { disabled?: boolean } }[],
): boolean {
  const touchables = queryAllByType(TouchableOpacity);
  expect(touchables).toHaveLength(1);
  return touchables[0]?.props.disabled === true;
}

interface AlertButton {
  text: string;
  variant?: string;
  onPress?: () => void;
}

interface CtaTestState {
  online: boolean | undefined;
  cancelRequest: Mock<(input: { id: string }) => void>;
  isCancelling: boolean;
  present: Mock<() => void>;
  alertButtons: AlertButton[];
  alertTitle: string;
  alertMessage: string;
}

const state = vi.hoisted<CtaTestState>(() => ({
  online: true,
  cancelRequest: vi.fn<(input: { id: string }) => void>(),
  isCancelling: false,
  present: vi.fn<() => void>(),
  alertButtons: [],
  alertTitle: "",
  alertMessage: "",
}));

vi.mock("~/shared/ui/hooks/use-is-online", () => ({
  useIsOnline: () => ({ data: state.online }),
}));
vi.mock("~/features/organizations/hooks/use-cancel-my-join-request", () => ({
  useCancelMyJoinRequest: () => ({
    cancelRequest: state.cancelRequest,
    isPending: state.isCancelling,
  }),
}));
vi.mock("~/features/organizations/components/join-request-sheet", () => ({
  JoinRequestSheet: React.forwardRef<{ present: () => void }>(function JoinRequestSheet(_p, ref) {
    React.useImperativeHandle(ref, () => ({ present: state.present }));
    return null;
  }),
}));
vi.mock("~/shared/ui/AlertDialog", () => ({
  showAlert: (title: string, message: string, buttons: AlertButton[]) => {
    state.alertTitle = title;
    state.alertMessage = message;
    state.alertButtons = buttons;
  },
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ warningFg: "#92400e", brand: "#005e5e" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => {
      const labels: Record<string, string> = {
        "common:cancel": "Cancel",
        "organizations:join.cta": "Request to join",
        "organizations:join.pending": "Your request is pending",
        "organizations:join.cancel": "Cancel request",
        "organizations:join.cancelConfirmTitle": "Cancel your request?",
        "organizations:join.offlineHint": "You're offline. Reconnect to send this.",
      };
      if (key === "organizations:join.cancelConfirmBody") {
        return `Withdraw your request to ${String(values?.name)}`;
      }
      return labels[key] ?? key;
    },
  }),
}));

const BASE = {
  id: "org-1",
  name: "Photosynthesis Lab",
  visibility: "public" as const,
};

beforeEach(() => {
  state.online = true;
  state.isCancelling = false;
  state.cancelRequest.mockClear();
  state.present.mockClear();
  state.alertButtons = [];
  state.alertTitle = "";
  state.alertMessage = "";
});

describe("OrganizationJoinCta", () => {
  describe("none", () => {
    it("offers Request to join and presents the sheet", () => {
      render(<OrganizationJoinCta {...BASE} membershipStatus="none" />);

      fireEvent.press(screen.getByText("Request to join"));

      expect(state.present).toHaveBeenCalledOnce();
      expect(screen.queryByText("Cancel request")).toBeNull();
    });

    it("renders nothing for an organization that is not joinable", () => {
      render(<OrganizationJoinCta {...BASE} visibility="private" membershipStatus="none" />);

      expect(screen.queryByText("Request to join")).toBeNull();
    });

    it("leaves the button enabled while online", () => {
      const { UNSAFE_queryAllByType } = render(
        <OrganizationJoinCta {...BASE} membershipStatus="none" />,
      );

      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(false);
      expect(screen.queryByText("You're offline. Reconnect to send this.")).toBeNull();
    });

    it("disables the button and explains why when offline", () => {
      state.online = false;

      const { UNSAFE_queryAllByType } = render(
        <OrganizationJoinCta {...BASE} membershipStatus="none" />,
      );

      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(true);
      expect(screen.getByText("You're offline. Reconnect to send this.")).toBeTruthy();
    });

    it("stays enabled on the first render, before connectivity is known", () => {
      state.online = undefined;

      const { UNSAFE_queryAllByType } = render(
        <OrganizationJoinCta {...BASE} membershipStatus="none" />,
      );

      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(false);
      expect(screen.queryByText("You're offline. Reconnect to send this.")).toBeNull();
    });
  });

  describe("pending_request", () => {
    it("shows the pending banner and a cancel button, not the join CTA", () => {
      render(<OrganizationJoinCta {...BASE} membershipStatus="pending_request" />);

      expect(screen.getByText("Your request is pending")).toBeTruthy();
      expect(screen.getByText("Cancel request")).toBeTruthy();
      expect(screen.queryByText("Request to join")).toBeNull();
    });

    it("confirms before cancelling, and only mutates once confirmed", () => {
      render(<OrganizationJoinCta {...BASE} membershipStatus="pending_request" />);

      fireEvent.press(screen.getByText("Cancel request"));

      expect(state.cancelRequest).not.toHaveBeenCalled();
      expect(state.alertTitle).toBe("Cancel your request?");
      expect(state.alertMessage).toBe("Withdraw your request to Photosynthesis Lab");
      expect(state.alertButtons.map((b) => b.text)).toEqual(["Cancel request", "Cancel"]);

      state.alertButtons[0]?.onPress?.();
      expect(state.cancelRequest).toHaveBeenCalledWith({ id: "org-1" });
    });

    it("leaves the request alone when the dialog is dismissed", () => {
      render(<OrganizationJoinCta {...BASE} membershipStatus="pending_request" />);

      fireEvent.press(screen.getByText("Cancel request"));
      state.alertButtons[1]?.onPress?.();

      expect(state.cancelRequest).not.toHaveBeenCalled();
    });

    it("disables cancel and explains why when offline", () => {
      state.online = false;

      const { UNSAFE_queryAllByType } = render(
        <OrganizationJoinCta {...BASE} membershipStatus="pending_request" />,
      );

      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(true);
      expect(screen.getByText("You're offline. Reconnect to send this.")).toBeTruthy();
    });

    it("disables cancel while the withdrawal is in flight", () => {
      state.isCancelling = true;

      const { UNSAFE_queryAllByType } = render(
        <OrganizationJoinCta {...BASE} membershipStatus="pending_request" />,
      );

      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(true);
    });
  });

  describe("member", () => {
    it("renders nothing: the role is a label on the name row, not an action here", () => {
      const { toJSON } = render(<OrganizationJoinCta {...BASE} membershipStatus="member" />);

      expect(toJSON()).toBeNull();
    });

    it("offers neither joining nor cancelling to someone already in", () => {
      render(<OrganizationJoinCta {...BASE} membershipStatus="member" />);

      expect(screen.queryByText("Request to join")).toBeNull();
      expect(screen.queryByText("Cancel request")).toBeNull();
    });

    it("says nothing about being 'a member', in any role", () => {
      render(<OrganizationJoinCta {...BASE} membershipStatus="member" />);

      expect(screen.queryByText(/member/iu)).toBeNull();
      expect(screen.queryByText("Joined")).toBeNull();
    });
  });
});
