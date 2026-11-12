import { createTestQueryClient, render, screen, userEvent } from "@/test/test-utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { ConnectResultBanner } from "./connect-result-banner";

const SECURITY = "/en-US/platform/account/security";

function arriveWith(query: string) {
  vi.mocked(usePathname).mockReturnValue(SECURITY);
  vi.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams(query));
}

describe("ConnectResultBanner", () => {
  it.each([
    ["connected=github", "signInMethods.connectedGithubTitle", "signInMethods.connectedGithubBody"],
    ["connected=orcid", "signInMethods.connectedOrcidTitle", "signInMethods.connectedOrcidBody"],
    [
      "connect=orcid&error=access_denied",
      "signInMethods.nothingChanged",
      "signInMethods.connectCancelled:ORCID",
    ],
    [
      "connect=github&error=account_already_linked_to_different_user",
      "signInMethods.nothingChanged",
      "signInMethods.connectAlreadyLinked:GitHub",
    ],
    [
      "connect=orcid&error=unable_to_link_account",
      "signInMethods.nothingChanged",
      "signInMethods.connectDidNotFinish:ORCID",
    ],
    ["connect=github", "signInMethods.nothingChanged", "signInMethods.connectDidNotFinish:GitHub"],
  ])("on ?%s says %s %s", (query, title, body) => {
    arriveWith(query);

    render(<ConnectResultBanner />);

    expect(screen.getByRole("alert")).toHaveTextContent(`${title}${body}`);
  });

  it("drops the parameters from the URL so a reload does not repeat the line", () => {
    arriveWith(
      "connect=orcid&error=access_denied&error_description=The+user+has+denied+access.&tab=keep",
    );

    render(<ConnectResultBanner />);

    expect(useRouter().replace).toHaveBeenCalledWith(`${SECURITY}?tab=keep`, { scroll: false });
    expect(screen.getByText("signInMethods.connectCancelled:ORCID")).toBeInTheDocument();
  });

  it("refreshes the account list after a connect", () => {
    arriveWith("connected=github");
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(<ConnectResultBanner />, { queryClient });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "accounts"] });
    expect(useRouter().replace).toHaveBeenCalledWith(SECURITY, { scroll: false });
  });

  it("shows nothing for a provider it does not know, and still cleans the URL", () => {
    arriveWith("connected=gitlab");

    render(<ConnectResultBanner />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith(SECURITY, { scroll: false });
  });

  it("leaves the URL alone when it carries no result", () => {
    arriveWith("error=access_denied");

    render(<ConnectResultBanner />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it("goes away when dismissed", async () => {
    arriveWith("connected=orcid");

    render(<ConnectResultBanner />);
    await userEvent.setup().click(screen.getByRole("button", { name: "signInMethods.dismiss" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
