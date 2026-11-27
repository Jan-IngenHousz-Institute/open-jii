// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePostRegistrationRedirect } from "~/features/auth/hooks/use-post-registration-redirect";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
const router = { push };
vi.mock("expo-router", () => ({ useRouter: () => router }));

function renderRedirect(initial: { isSignedIn: boolean; needsRegistration: boolean }) {
  return renderHook(
    ({ isSignedIn, needsRegistration }) =>
      usePostRegistrationRedirect(isSignedIn, needsRegistration),
    { initialProps: initial },
  );
}

describe("usePostRegistrationRedirect", () => {
  beforeEach(() => push.mockReset());

  it("opens Discover once registration completes", () => {
    const { rerender } = renderRedirect({ isSignedIn: true, needsRegistration: true });
    expect(push).not.toHaveBeenCalled();

    rerender({ isSignedIn: true, needsRegistration: false });
    expect(push).toHaveBeenCalledWith("/discover");

    rerender({ isSignedIn: true, needsRegistration: false });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("leaves an already registered user where the app opened", () => {
    const { rerender } = renderRedirect({ isSignedIn: true, needsRegistration: false });
    rerender({ isSignedIn: true, needsRegistration: false });

    expect(push).not.toHaveBeenCalled();
  });

  it("forgets the pending registration when the user signs out instead", () => {
    const { rerender } = renderRedirect({ isSignedIn: true, needsRegistration: true });
    rerender({ isSignedIn: false, needsRegistration: false });
    rerender({ isSignedIn: true, needsRegistration: false });

    expect(push).not.toHaveBeenCalled();
  });
});
