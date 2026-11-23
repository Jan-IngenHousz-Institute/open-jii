import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient } from "@repo/auth/client";

import { RegistrationForm } from "./registration-form";

// Unlike registration-form.test.tsx, this keeps the real useUpdateUser: its success handler
// revalidates auth, and that revalidation is what sends a sibling-app sign-in away.
const { mockSubscribeNewsletter, events } = vi.hoisted(() => ({
  mockSubscribeNewsletter: vi.fn(),
  events: [] as string[],
}));

vi.mock("~/lib/orpc", () => ({
  orpc: {
    newsletter: {
      subscribeDirect: {
        mutationOptions: () => ({ mutationFn: mockSubscribeNewsletter }),
      },
    },
  },
}));

vi.mock("@repo/ui/hooks/use-toast", () => ({ toast: vi.fn() }));

vi.mock("~/hooks/profile/useCreateUserProfile/useCreateUserProfile", () => ({
  useCreateUserProfile: (opts: { onSuccess?: () => Promise<void> | void }) => ({
    mutateAsync: async () => {
      if (opts.onSuccess) await opts.onSuccess();
    },
  }),
}));

const termsData = { title: "Terms and Conditions", content: "Mock terms content" };

async function register(callbackUrl: string) {
  render(
    <RegistrationForm
      callbackUrl={callbackUrl}
      termsData={termsData}
      userEmail="new@example.com"
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("registration.firstName"), "News");
  await user.type(screen.getByLabelText("registration.lastName"), "Reader");
  await user.click(screen.getByRole("checkbox", { name: "registration.acceptTerms" }));
  await user.click(screen.getByRole("checkbox", { name: "registration.newsletterOptIn" }));
  await user.click(screen.getByRole("button", { name: "registration.register" }));
}

describe("RegistrationForm newsletter opt-in and the registration revalidation", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    events.length = 0;
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(authClient.updateUser).mockImplementation(() => {
      events.push("registered saved");
      return Promise.resolve({ data: { success: true }, error: null }) as never;
    });
    vi.mocked(revalidateAuth).mockImplementation(() => {
      // In the app this re-renders the register page, which redirects a sibling-app sign-in.
      events.push("auth revalidated");
      return Promise.resolve();
    });
    mockSubscribeNewsletter.mockImplementation(async () => {
      events.push("subscription sent");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("subscription settled");
      return { status: "subscribed" };
    });
  });

  it("settles the opt-in before saving registration when returning to openJII Lab", async () => {
    const callbackUrl = "http://localhost:3100/login/openjii";
    await register(callbackUrl);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(callbackUrl));
    expect(events).toEqual([
      "subscription sent",
      "subscription settled",
      "registered saved",
      "auth revalidated",
    ]);
  });

  it("sends the opt-in before saving registration for a same-origin return", async () => {
    await register("/dashboard");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
    await waitFor(() => expect(events).toContain("subscription settled"));
    // A same-origin return does not wait for the opt-in, so it can settle anywhere after it is sent.
    expect(events.filter((event) => event !== "subscription settled")).toEqual([
      "subscription sent",
      "registered saved",
      "auth revalidated",
    ]);
    expect(events.indexOf("subscription settled")).toBeGreaterThan(
      events.indexOf("subscription sent"),
    );
  });
});
