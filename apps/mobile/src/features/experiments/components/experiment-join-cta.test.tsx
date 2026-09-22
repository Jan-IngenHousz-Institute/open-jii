import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentJoinCta } from "./experiment-join-cta";

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
  requestId: string | undefined;
  isRequestNone: boolean;
  cancelRequest: Mock<(input: { id: string; requestId: string }) => void>;
  isCancelling: boolean;
  flowExperimentId: string | undefined;
  selectedExperimentId: string | undefined;
  pushed: string[];
  presentedRequestSheet: Mock<() => void>;
  presentedCodeSheet: Mock<() => void>;
  alertButtons: AlertButton[];
  alertTitle: string;
  alertMessage: string;
}

const state = vi.hoisted<CtaTestState>(() => ({
  online: true,
  requestId: "req-1",
  isRequestNone: false,
  cancelRequest: vi.fn<(input: { id: string; requestId: string }) => void>(),
  isCancelling: false,
  flowExperimentId: undefined,
  selectedExperimentId: undefined,
  pushed: [],
  presentedRequestSheet: vi.fn<() => void>(),
  presentedCodeSheet: vi.fn<() => void>(),
  alertButtons: [],
  alertTitle: "",
  alertMessage: "",
}));

vi.mock("expo-router", () => ({
  router: { push: (target: unknown) => state.pushed.push(target as string) },
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({ useIsOnline: () => ({ data: state.online }) }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ warningFg: "#92400e", brand: "#005e5e", onSurface: "#121212" }),
}));
vi.mock("~/features/experiments/hooks/use-my-experiment-join-request", () => ({
  useMyExperimentJoinRequest: () => ({
    requestId: state.requestId,
    isNone: state.isRequestNone,
  }),
}));
vi.mock("~/features/experiments/hooks/use-cancel-my-experiment-join-request", () => ({
  useCancelMyExperimentJoinRequest: () => ({
    cancelRequest: state.cancelRequest,
    isPending: state.isCancelling,
  }),
}));
vi.mock("~/features/experiments/stores/use-experiment-selection-store", () => ({
  useExperimentSelectionStore: {
    getState: () => ({
      setSelectedExperimentId: (id?: string) => {
        state.selectedExperimentId = id;
      },
    }),
  },
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (s: { experimentId?: string }) => unknown) =>
    selector({ experimentId: state.flowExperimentId }),
}));
vi.mock("~/features/experiments/components/experiment-join-request-sheet", () => ({
  ExperimentJoinRequestSheet: React.forwardRef<{ present: () => void }>(
    function ExperimentJoinRequestSheet(_p, ref) {
      React.useImperativeHandle(ref, () => ({ present: state.presentedRequestSheet }));
      return null;
    },
  ),
}));
vi.mock("~/features/experiments/components/join-code-entry-sheet", () => ({
  JoinCodeEntrySheet: React.forwardRef<{ present: () => void }>(
    function JoinCodeEntrySheet(_p, ref) {
      React.useImperativeHandle(ref, () => ({ present: state.presentedCodeSheet }));
      return null;
    },
  ),
}));
vi.mock("~/shared/ui/AlertDialog", () => ({
  showAlert: (title: string, message: string, buttons: AlertButton[]) => {
    state.alertTitle = title;
    state.alertMessage = message;
    state.alertButtons = buttons;
  },
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) => {
      if (key === "experiments:join.cancelConfirmBody") {
        return `Withdraw your request to ${String(values?.name)}`;
      }
      return (
        {
          "common:cancel": "Cancel",
          "experiments:detail.startMeasuring": "Start measuring",
          "experiments:detail.noWorkbook": "This experiment has no measurement workbook yet",
          "experiments:detail.flowInProgress": "A measurement is in progress",
          "experiments:detail.flowInProgressAction": "Open it",
          "experiments:join.cta": "Request to join",
          "experiments:join.pending": "Your request is pending",
          "experiments:join.cancel": "Cancel request",
          "experiments:join.cancelConfirmTitle": "Cancel your request?",
          "experiments:join.offlineHint": "You're offline. Reconnect to send this.",
          "experiments:join.haveCode": "Have a join code?",
        }[key] ?? key
      );
    },
  }),
}));

const BASE = {
  id: "exp-1",
  name: "Canopy Phi2 Sweep",
  status: "active" as const,
  workbookVersionId: "wv-1",
  onRefreshAccess: vi.fn(),
};

beforeEach(() => {
  state.online = true;
  state.requestId = "req-1";
  state.isRequestNone = false;
  state.isCancelling = false;
  state.flowExperimentId = undefined;
  state.selectedExperimentId = undefined;
  state.pushed = [];
  state.cancelRequest.mockClear();
  state.presentedRequestSheet.mockClear();
  state.presentedCodeSheet.mockClear();
  state.alertButtons = [];
  state.alertTitle = "";
  state.alertMessage = "";
  BASE.onRefreshAccess.mockClear();
});

describe("ExperimentJoinCta", () => {
  describe("member", () => {
    it("selects the experiment and opens the picker, not the flow itself", () => {
      render(<ExperimentJoinCta {...BASE} membershipStatus="member" />);

      fireEvent.press(screen.getByText("Start measuring"));

      expect(state.selectedExperimentId).toBe("exp-1");
      expect(state.pushed).toEqual(["/measurement-flow"]);
    });

    it("disables Start measuring and says why when no workbook is pinned", () => {
      const { UNSAFE_queryAllByType } = render(
        <ExperimentJoinCta {...BASE} workbookVersionId={null} membershipStatus="member" />,
      );

      expect(screen.getByText("This experiment has no measurement workbook yet")).toBeTruthy();
      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(true);
    });

    it("leaves Start measuring enabled when the experiment is ready", () => {
      const { UNSAFE_queryAllByType } = render(
        <ExperimentJoinCta {...BASE} membershipStatus="member" />,
      );

      expect(onlyButtonIsDisabled(UNSAFE_queryAllByType)).toBe(false);
    });

    it("banners a flow already in progress and opens it without switching the selection", () => {
      state.flowExperimentId = "exp-other";

      render(<ExperimentJoinCta {...BASE} membershipStatus="member" />);

      expect(screen.getByText("A measurement is in progress")).toBeTruthy();
      expect(screen.queryByText("Start measuring")).toBeNull();

      fireEvent.press(screen.getByText("Open it"));
      expect(state.pushed).toEqual(["/measurement-flow"]);
      expect(state.selectedExperimentId).toBeUndefined();
    });

    it("offers nothing on an archived experiment, member or not", () => {
      const { toJSON } = render(
        <ExperimentJoinCta {...BASE} status="archived" membershipStatus="member" />,
      );

      expect(toJSON()).toBeNull();
    });
  });

  describe("pending_request", () => {
    it("shows the pending banner and Cancel, not the join CTA", () => {
      render(<ExperimentJoinCta {...BASE} membershipStatus="pending_request" />);

      expect(screen.getByText("Your request is pending")).toBeTruthy();
      expect(screen.getByText("Cancel request")).toBeTruthy();
      expect(screen.queryByText("Request to join")).toBeNull();
      expect(screen.queryByText("Start measuring")).toBeNull();
    });

    it("confirms before cancelling, and only mutates once confirmed", () => {
      render(<ExperimentJoinCta {...BASE} membershipStatus="pending_request" />);

      fireEvent.press(screen.getByText("Cancel request"));

      expect(state.cancelRequest).not.toHaveBeenCalled();
      expect(state.alertTitle).toBe("Cancel your request?");
      expect(state.alertMessage).toBe("Withdraw your request to Canopy Phi2 Sweep");

      state.alertButtons[0]?.onPress?.();
      expect(state.cancelRequest).toHaveBeenCalledWith({ id: "exp-1", requestId: "req-1" });
    });

    it("leaves the request alone when the dialog is dismissed", () => {
      render(<ExperimentJoinCta {...BASE} membershipStatus="pending_request" />);

      fireEvent.press(screen.getByText("Cancel request"));
      state.alertButtons[1]?.onPress?.();

      expect(state.cancelRequest).not.toHaveBeenCalled();
    });

    it("refreshes access instead of offering a broken Cancel when the request is gone", () => {
      state.requestId = undefined;
      state.isRequestNone = true;

      render(<ExperimentJoinCta {...BASE} membershipStatus="pending_request" />);

      expect(BASE.onRefreshAccess).toHaveBeenCalledOnce();
      fireEvent.press(screen.getByText("Cancel request"));
      expect(state.alertButtons).toEqual([]);
    });

    it("does not re-ask for access on every render", () => {
      state.requestId = undefined;
      state.isRequestNone = true;

      const { rerender } = render(
        <ExperimentJoinCta {...BASE} membershipStatus="pending_request" />,
      );
      rerender(<ExperimentJoinCta {...BASE} membershipStatus="pending_request" />);

      expect(BASE.onRefreshAccess).toHaveBeenCalledOnce();
    });
  });

  describe("none", () => {
    it("offers Request to join and presents the sheet", () => {
      render(<ExperimentJoinCta {...BASE} membershipStatus="none" />);

      fireEvent.press(screen.getByText("Request to join"));

      expect(state.presentedRequestSheet).toHaveBeenCalledOnce();
      expect(screen.queryByText("Cancel request")).toBeNull();
    });

    it("offers the code entry sheet as the second way in", () => {
      render(<ExperimentJoinCta {...BASE} membershipStatus="none" />);

      fireEvent.press(screen.getByText("Have a join code?"));

      expect(state.presentedCodeSheet).toHaveBeenCalledOnce();
      expect(state.pushed).toEqual([]);
    });

    it("explains why Request to join is unavailable while offline", () => {
      state.online = false;

      render(<ExperimentJoinCta {...BASE} membershipStatus="none" />);

      expect(screen.getByText("You're offline. Reconnect to send this.")).toBeTruthy();
    });

    it("offers nothing on an archived experiment", () => {
      const { toJSON } = render(
        <ExperimentJoinCta {...BASE} status="archived" membershipStatus="none" />,
      );

      expect(toJSON()).toBeNull();
    });
  });
});
