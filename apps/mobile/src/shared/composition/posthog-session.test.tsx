import { render } from "@testing-library/react-native";
import { expect, it, vi } from "vitest";
import { usePostHogIdentity } from "~/shared/observability/use-posthog-identity";
import { useScreenViews } from "~/shared/observability/use-screen-views";

import { PostHogSession } from "./posthog-session";

const { posthog, session } = vi.hoisted(() => {
  const session: { user: { id: string; isAnonymous: boolean | undefined } } = {
    user: { id: "owner", isAnonymous: undefined },
  };
  return { posthog: { identify: vi.fn() }, session };
});
vi.mock("posthog-react-native", () => ({ usePostHog: () => posthog }));
vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => session }));
vi.mock("~/shared/observability/use-posthog-identity", () => ({ usePostHogIdentity: vi.fn() }));
vi.mock("~/shared/observability/use-screen-views", () => ({ useScreenViews: vi.fn() }));

it.each([true, false, undefined])(
  "forwards guest=%s to the analytics identity policy",
  (isAnonymous) => {
    session.user.isAnonymous = isAnonymous;
    render(<PostHogSession />);
    expect(usePostHogIdentity).toHaveBeenLastCalledWith(posthog, "owner", isAnonymous === true);
    expect(useScreenViews).toHaveBeenCalledWith(posthog);
  },
);
