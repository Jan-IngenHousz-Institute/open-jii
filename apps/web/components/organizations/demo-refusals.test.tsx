import {
  createMyOrganization,
  createOrganizationJoinRequest,
  createSession,
  createUseSessionResult,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { TEST_LOCALES, mockRealTranslations } from "@/test/real-i18n";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";
import de from "@repo/i18n/locales/de-DE/common.json";
import en from "@repo/i18n/locales/en-US/common.json";
import nl from "@repo/i18n/locales/nl-NL/common.json";
import { Toaster } from "@repo/ui/components/toaster";

import { OrganizationJoinRequests } from "./organization-join-requests";
import { ResourceTransferDialog } from "./resource-transfer-dialog";

vi.unmock("@repo/ui/hooks/use-toast");

const bundles = { "en-US": en, "nl-NL": nl, "de-DE": de };

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue(
    createUseSessionResult({
      data: createSession({ user: { id: "researcher" } }),
      isPending: false,
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function refusal(code: string) {
  return {
    defined: false,
    code: "BAD_REQUEST",
    status: 400,
    message: "Server English",
    data: { code },
  };
}

describe.each(TEST_LOCALES)("Demo refusals in %s", (locale) => {
  it("renders the translated private-resource refusal when a transfer fails", async () => {
    await mockRealTranslations(locale);
    const copy = bundles[locale].organizations.transfer;
    const user = userEvent.setup();
    const close = vi.fn();
    server.mount(contract.organizations.listMyOrganizations, {
      body: [
        createMyOrganization({
          id: "00000000-0000-0000-0000-000000000002",
          name: "Demo lab",
          visibility: "public",
        }),
      ],
    });
    server.mount(contract.sharing.transferResourceOrganization, {
      status: 400,
      body: refusal("DEMO_RESOURCE_PUBLIC_REQUIRED"),
    });
    render(
      <>
        <ResourceTransferDialog
          resourceType="experiment"
          resourceId="00000000-0000-0000-0000-000000000001"
          currentOrganizationId={null}
          open
          onOpenChange={close}
        />
        <Toaster />
      </>,
    );

    const picker = screen.getByRole("combobox", { name: copy.targetLabel });
    await waitFor(() => expect(picker).toBeEnabled());
    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: "Demo lab" }));
    await user.click(screen.getByRole("button", { name: copy.confirm }));

    expect(await screen.findByText(copy.failed_demoPublicRequired)).toBeVisible();
    expect(screen.queryByText("Server English")).not.toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });

  it("renders the translated approval refusal if the organization became Demo after loading", async () => {
    await mockRealTranslations(locale);
    const copy = bundles[locale].organizations.requests;
    const user = userEvent.setup();
    server.mount(contract.organizations.listOrganizationJoinRequests, {
      body: [createOrganizationJoinRequest({ status: "pending" })],
    });
    const decision = server.mount(contract.organizations.decideOrganizationJoinRequest, {
      status: 400,
      body: refusal("DEMO_JOIN_REQUEST_APPROVAL_DISABLED"),
    });
    render(
      <>
        <OrganizationJoinRequests organizationId="org-1" organizationType="university" />
        <Toaster />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: copy.approveAction }));

    expect(await screen.findByText(copy.decisionFailed_demoApprovalDisabled)).toBeVisible();
    expect(screen.queryByText("Server English")).not.toBeInTheDocument();
    expect(decision.body).toEqual({ decision: "approve" });
  });
});
