import { PrincipalProvider } from "@/components/auth/principal-context";
import { render, screen } from "@/test/test-utils";
import { redirect, usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountLayout from "./layout";

vi.mock("@/hooks/useLocale", () => ({ useLocale: () => "en-US" }));

describe("AccountLayout", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/account");
  });

  it("gives a researcher every account tab", () => {
    render(
      <PrincipalProvider userId="user-1">
        <AccountLayout>
          <p>General</p>
        </AccountLayout>
      </PrincipalProvider>,
    );

    expect(redirect).not.toHaveBeenCalled();
    for (const tab of ["tabs.general", "tabs.security", "tabs.apiKeys"]) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }
  });

  it("sends a guest home, since every account tab refuses guests", () => {
    render(
      <PrincipalProvider userId="guest" isGuest>
        <AccountLayout>
          <p>General</p>
        </AccountLayout>
      </PrincipalProvider>,
    );

    expect(redirect).toHaveBeenCalledWith("/en-US/platform");
  });
});
