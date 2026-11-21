import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRegistration } from "~/features/auth/hooks/use-registration";

const { completeRegistration, subscribeToNewsletter, toastSuccess, toastError } = vi.hoisted(
  () => ({
    completeRegistration: vi.fn(),
    subscribeToNewsletter: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }),
);

vi.mock("~/features/auth/api/registration.api", () => ({
  completeRegistration,
  subscribeToNewsletter,
}));
vi.mock("~/shared/api/orpc", () => ({
  orpc: { users: { getUserProfile: { key: () => ["users", "getUserProfile"] } } },
}));
vi.mock("sonner-native", () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const profile = { firstName: "Ada", lastName: "Lovelace", avatarUrl: null };

beforeEach(() => {
  vi.resetAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  completeRegistration.mockResolvedValue(undefined);
  subscribeToNewsletter.mockResolvedValue({ status: "subscribed" });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

async function register(newsletterOptIn: boolean) {
  const { result } = renderHook(() => useRegistration(), { wrapper });
  // A failed registration rejects here; the tests assert on what the hook reported instead.
  await act(() => result.current.mutateAsync({ ...profile, newsletterOptIn }).catch(() => null));
}

describe("useRegistration", () => {
  it("registers, refreshes the cached profile and confirms the account is ready", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await register(false);

    expect(completeRegistration).toHaveBeenCalledWith(profile);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["users", "getUserProfile"] });
    expect(toastSuccess).toHaveBeenCalledWith("registration.successMessage");
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it("subscribes to the newsletter only when the person opted in", async () => {
    await register(true);

    expect(subscribeToNewsletter).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("points to account settings when the newsletter subscription fails", async () => {
    subscribeToNewsletter.mockRejectedValue(new Error("Newsletter is not configured"));

    await register(true);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("registration.newsletterOptInError"),
    );
    expect(toastSuccess).toHaveBeenCalledWith("registration.successMessage");
  });

  it("asks the person to contact support when the address was erased from the newsletter", async () => {
    subscribeToNewsletter.mockRejectedValue(
      new ORPCError("BAD_REQUEST", { data: { code: "MAILCHIMP_FORGOTTEN_EMAIL" } }),
    );

    await register(true);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("registration.newsletterForgottenEmail"),
    );
  });

  it("reports a failed registration and does not subscribe", async () => {
    completeRegistration.mockRejectedValue(new Error("Internal Server Error"));

    await register(true);

    expect(toastError).toHaveBeenCalledWith("registration.errorMessage");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });
});
