import { NewOrganizationVisibilityCard } from "@/components/new-organization/new-organization-visibility-card";
import type { NewOrganizationFormValues } from "@/components/new-organization/steps/form-step";
import { NO_TYPE, peopleSchema } from "@/components/new-organization/steps/form-step";
import { ReviewStep } from "@/components/new-organization/steps/review-step/review-step";
import { createOrganizationProfile, createOrganizationResource } from "@/test/factories";
import { server } from "@/test/msw/server";
import { TEST_LOCALES, mockRealTranslations } from "@/test/real-i18n";
import type { TestLocale } from "@/test/real-i18n";
import { render, renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { authClient, useSession } from "@repo/auth/client";
import de from "@repo/i18n/locales/de-DE/common.json";
import en from "@repo/i18n/locales/en-US/common.json";
import nl from "@repo/i18n/locales/nl-NL/common.json";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationOverview } from "./organization-overview";
import { OrganizationSettingsSurface } from "./organization-settings-surface";

const NO_TOTALS = {
  experiment: 0,
  protocol: 0,
  macro: 0,
  workbook: 0,
  device: 0,
  device_group: 0,
  calibration_definition: 0,
};

const bundles = { "en-US": en, "nl-NL": nl, "de-DE": de };

type Kind = "private" | "public" | "demo";
const KINDS: readonly Kind[] = ["private", "public", "demo"];

function renderVisibilityCard(type: string, visibility: "private" | "public") {
  return renderWithForm<NewOrganizationFormValues>(
    (form) => <NewOrganizationVisibilityCard form={form} />,
    {
      useFormProps: {
        defaultValues: {
          name: "Greenhouse Lab",
          slug: "greenhouse-lab",
          type: type as NewOrganizationFormValues["type"],
          description: "",
          website: "",
          location: "",
          visibility,
          people: [],
        },
      },
    },
  );
}

function renderReview(type: string, visibility: "private" | "public") {
  return renderWithForm<NewOrganizationFormValues>(
    (form) => (
      <ReviewStep
        form={form}
        step={{ title: "review", validationSchema: peopleSchema, component: ReviewStep }}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        goToStep={vi.fn()}
        stepIndex={3}
        totalSteps={4}
      />
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Greenhouse Lab",
          slug: "greenhouse-lab",
          type: type as NewOrganizationFormValues["type"],
          description: "",
          website: "",
          location: "",
          visibility,
          people: [],
        },
      },
    },
  );
}

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

describe.each(TEST_LOCALES)("Demo organization copy in %s", (locale: TestLocale) => {
  const copy = bundles[locale].organizations;

  afterEach(() => {
    vi.restoreAllMocks();
    mockSession(null);
  });

  it("gives each visibility kind its own review note", async () => {
    const notes: Record<Kind, string> = {
      private: copy.create.visibilityNote_private,
      public: copy.create.visibilityNote_public,
      demo: copy.create.visibilityNote_demo,
    };
    expect(new Set(Object.values(notes)).size).toBe(3);

    for (const [type, visibility, kind] of [
      [NO_TYPE, "private", "private"],
      ["university", "public", "public"],
      ["demo", "public", "demo"],
    ] as const) {
      await mockRealTranslations(locale);
      const { unmount } = renderReview(type, visibility);
      expect(screen.getByText(notes[kind])).toBeInTheDocument();
      for (const other of KINDS.filter((candidate) => candidate !== kind)) {
        expect(screen.queryByText(notes[other])).not.toBeInTheDocument();
      }
      unmount();
    }
  });

  it("words the visibility card for an ordinary and for a Demo organization", async () => {
    await mockRealTranslations(locale);
    const ordinary = renderVisibilityCard("university", "private");
    expect(screen.getByText(copy.visibility.description)).toBeInTheDocument();
    expect(screen.getByText(copy.visibility.hint_private)).toBeInTheDocument();
    expect(screen.getByText(copy.visibility.hint_public)).toBeInTheDocument();
    expect(screen.queryByText(copy.visibility.description_demo)).not.toBeInTheDocument();
    ordinary.unmount();

    renderVisibilityCard("demo", "public");
    expect(screen.getByText(copy.visibility.description_demo)).toBeInTheDocument();
    expect(screen.getByText(copy.visibility.hint_demo)).toBeInTheDocument();
    expect(screen.getByText(copy.visibility.hint_private)).toBeInTheDocument();
    expect(screen.queryByText(copy.visibility.hint_public)).not.toBeInTheDocument();
  });

  it("tells a visitor to a Demo organization what viewing it allows", async () => {
    await mockRealTranslations(locale);
    mockSession({ id: "visitor" });
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({
        id: "org-1",
        role: null,
        membershipStatus: "none",
        type: "demo",
        visibility: "public",
      }),
    });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [], totals: NO_TOTALS },
    });

    render(<OrganizationOverview organizationId="org-1" />);

    expect(await screen.findByText(copy.overview.visitorNotice_demo)).toBeInTheDocument();
    expect(screen.queryByText(copy.overview.visitorNotice)).not.toBeInTheDocument();
  });

  it("tells a visitor to an ordinary public organization to ask to join", async () => {
    await mockRealTranslations(locale);
    mockSession({ id: "visitor" });
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({
        id: "org-1",
        role: null,
        membershipStatus: "none",
        type: "university",
        visibility: "public",
      }),
    });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [], totals: NO_TOTALS },
    });

    render(<OrganizationOverview organizationId="org-1" />);

    expect(await screen.findByText(copy.overview.visitorNotice)).toBeInTheDocument();
    expect(screen.queryByText(copy.overview.visitorNotice_demo)).not.toBeInTheDocument();
  });

  it("explains a refused Demo conversion in the locale and lists only publishable kinds", async () => {
    const user = userEvent.setup();
    await mockRealTranslations(locale);
    mockSession({ id: "owner" });
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({ id: "org-1", role: "owner", type: "university" }),
    });
    server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: true } });
    server.mount(contract.organizations.listOrganizationResources, {
      body: {
        totals: NO_TOTALS,
        resources: [
          createOrganizationResource({ name: "Unpublished trial", visibility: "private" }),
          createOrganizationResource({ type: "device", name: "Field rack", visibility: "private" }),
        ],
      },
    });
    vi.mocked(authClient.organization.update).mockResolvedValueOnce({
      data: null,
      error: { code: "DEMO_PRIVATE_RESOURCES", message: "Server English" },
    });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.click(await screen.findByLabelText(copy.fields.type));
    await user.click(await screen.findByRole("option", { name: copy.types.demo }));
    await user.click(screen.getByRole("button", { name: bundles[locale].common.save }));

    expect(await screen.findByText(copy.settings.demoPrivateResources)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: copy.settings.saveError_demoPrivateResources,
        variant: "destructive",
      }),
    );
    expect(screen.getByRole("link", { name: "Unpublished trial" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Field rack" })).not.toBeInTheDocument();
    expect(screen.queryByText("Server English")).not.toBeInTheDocument();
  });

  it("keeps the server's own message for a refusal the screen has no copy for", async () => {
    const user = userEvent.setup();
    await mockRealTranslations(locale);
    mockSession({ id: "owner" });
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({ id: "org-1", role: "owner", type: "university" }),
    });
    server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: false } });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [], totals: NO_TOTALS },
    });
    vi.mocked(authClient.organization.update).mockResolvedValueOnce({
      data: null,
      error: { code: "SLUG_TAKEN", message: "That slug is taken" },
    });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.type(await screen.findByLabelText(copy.fields.location), "Wageningen");
    await user.click(screen.getByRole("button", { name: bundles[locale].common.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "That slug is taken", variant: "destructive" }),
      ),
    );
  });

  it("words a concurrent change to the organization in the locale", async () => {
    const user = userEvent.setup();
    await mockRealTranslations(locale);
    mockSession({ id: "owner" });
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({ id: "org-1", role: "owner", type: "university" }),
    });
    server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: false } });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [], totals: NO_TOTALS },
    });
    vi.mocked(authClient.organization.update).mockResolvedValueOnce({
      data: null,
      error: {
        code: "ORGANIZATION_CHANGED",
        message: "The organization changed. Reload it before saving again.",
      },
    });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.type(await screen.findByLabelText(copy.fields.location), "Wageningen");
    await user.click(screen.getByRole("button", { name: bundles[locale].common.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: copy.settings.saveError_organization_changed,
          variant: "destructive",
        }),
      ),
    );
  });

  it("falls back to the generic save error when the refusal carries no message", async () => {
    const user = userEvent.setup();
    await mockRealTranslations(locale);
    mockSession({ id: "owner" });
    server.mount(contract.organizations.getOrganization, {
      body: createOrganizationProfile({ id: "org-1", role: "owner", type: "university" }),
    });
    server.mount(contract.users.getPlatformAdminAccess, { body: { isPlatformAdmin: false } });
    server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [], totals: NO_TOTALS },
    });
    vi.mocked(authClient.organization.update).mockResolvedValueOnce({
      data: null,
      error: { code: "UNKNOWN", message: "" },
    });

    render(<OrganizationSettingsSurface organizationId="org-1" />);

    await user.type(await screen.findByLabelText(copy.fields.location), "Wageningen");
    await user.click(screen.getByRole("button", { name: bundles[locale].common.save }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: copy.settings.saveError, variant: "destructive" }),
      ),
    );
  });
});

describe("context variants", () => {
  it.each(TEST_LOCALES)("%s ships every variant of each context key", (locale) => {
    const copy = bundles[locale].organizations;
    expect(Object.keys(copy.create).filter((key) => key.startsWith("visibilityNote_"))).toEqual(
      expect.arrayContaining([
        "visibilityNote_private",
        "visibilityNote_public",
        "visibilityNote_demo",
      ]),
    );
    expect(Object.keys(copy.visibility)).toEqual(
      expect.arrayContaining(["hint_private", "hint_public", "hint_demo", "description_demo"]),
    );
    expect(copy.overview).toHaveProperty("visitorNotice_demo");
    expect(copy.settings).toHaveProperty("saveError_demoPrivateResources");
  });

  it("no longer ships the retired one-off keys", () => {
    for (const locale of TEST_LOCALES) {
      const { organizations: o, platformAdmins: p } = bundles[locale];
      for (const retired of ["privateHint", "publicHint", "demoHint", "demoDescription"]) {
        expect(o.visibility, retired).not.toHaveProperty(retired);
      }
      for (const retired of ["privateNote", "publicNote", "demoNote"]) {
        expect(o.create, retired).not.toHaveProperty(retired);
      }
      expect(o.overview).not.toHaveProperty("demoVisitorNotice");
      expect(o.settings).not.toHaveProperty("saveFailed");
      expect(o.settings).not.toHaveProperty("demoConversionBlocked");
      expect(p).not.toHaveProperty("appointed");
      expect(p).not.toHaveProperty("removed");
    }
  });

  it("translates the platform admin copy instead of repeating the English", () => {
    const sameAsEnglish = Object.entries(de.platformAdmins).filter(
      ([key, value]) => value === en.platformAdmins[key as keyof typeof en.platformAdmins],
    );
    expect(sameAsEnglish).toEqual([]);
  });
});
