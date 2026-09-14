import type { CDPSession, Locator, Page } from "@playwright/test";

import type { FrameName } from "./frames.js";
import { experimentId, organizationId, protocolWorkbookId, workbookId } from "./seed-entities.js";

export interface Shot {
  /** Output basename under the staging directory. */
  readonly slug: string;
  /** Destination under apps/docs/public, so review can diff against what ships. */
  readonly publish: string;
  readonly frame: FrameName;
  /** Locale-less platform path, or a resolver for routes that need a seeded id. */
  readonly route: string | (() => Promise<string>);
  /** Drives the page to the documented state. Runs before a clip's timeline starts. */
  readonly prepare?: (page: Page) => Promise<void>;
  /** The flow a recording captures. Its presence is what makes a shot a video. */
  readonly perform?: (page: Page) => Promise<void>;
  /** Seconds held after `perform`, so a clip does not end mid-motion. */
  readonly tailSeconds?: number;
  /** Registers a virtual WebAuthn authenticator before the page loads. */
  readonly webauthn?: boolean;
  /** Capture without a session. Default is the seeded development session. */
  readonly anonymous?: boolean;
  /**
   * PostHog flags pinned on in the browser for this shot. The client SDK runs
   * cookieless until consent settles and reports no flags in that state, so a
   * flag-gated surface would otherwise never render; the backend still evaluates
   * the real flag for the seeded identity.
   */
  readonly featureFlags?: readonly string[];
  /** Why this asset exists, carried into apps/docs/media/web/manifest.json. */
  readonly scope: string;
}

const settle = (page: Page, ms = 900) => page.waitForTimeout(ms);

/** Clicks a control by accessible name whether it renders as a link or a button. */
async function activate(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name }).or(page.getByRole("link", { name })).first().click();
  await settle(page, 1200);
}

/** Types at a human cadence so a recording reads as use rather than as a fill. */
async function typeInto(target: Locator, text: string): Promise<void> {
  await target.click();
  await target.fill("");
  await target.pressSequentially(text, { delay: 55 });
}

export const SEED_WORKBOOK = "[Seed] Wheat Phenotyping Workbook";
export const ORG_OWNED_WORKBOOK = "Chamber QC Scratchpad";

/**
 * A capture that can contain a credential has to fail rather than publish one.
 * The one-time API-key dialog is the only surface in this manifest that ever
 * renders a secret, and a stale screenshot of it would leak a working key.
 */
/**
 * Passkeys and API keys accumulate across runs, so a rerun would publish a list
 * of duplicates. Clearing first makes the capture idempotent and leaves the
 * local account no more populated than it started.
 */
async function removeExistingRows(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const remove = page.getByRole("button", { name: /^(delete|remove|revoke)/i }).first();
    if (!(await remove.isVisible().catch(() => false))) return;
    await remove.click();
    await settle(page, 700);
    const confirm = page.getByRole("button", { name: /^(delete|remove|revoke|confirm)/i }).last();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await settle(page, 1400);
  }
}

/** Closes any open toast through its own control. */
async function dismissToasts(page: Page): Promise<void> {
  const toasts = page.locator("ol[class*='z-[100]'] li");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await toasts.count()) === 0) return;
    const close = toasts.first().getByRole("button").last();
    if (!(await close.isVisible().catch(() => false))) return;
    await close.click().catch(() => undefined);
    await settle(page, 600);
  }
}

async function assertNoSecretVisible(page: Page): Promise<void> {
  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const marker of ["copy this key now", "will not be shown again", "ojii_", "sk_"]) {
    if (body.includes(marker)) {
      throw new Error(`Refusing to capture: a one-time secret is still on screen (${marker})`);
    }
  }
}

export const SHOTS: readonly Shot[] = [
  // ------------------------------------------- tier 1: shell, overviews, access
  {
    slug: "dashboard",
    publish: "img/guide/web/dashboard.webp",
    frame: "desktop",
    route: "/platform",
    scope: "Authenticated dashboard: welcome card, recent experiments, compact contextual header",
  },
  {
    slug: "experiments-list",
    publish: "img/guide/web/experiments-list.webp",
    frame: "desktop",
    route: "/platform/experiments",
    scope: "Experiments overview: search, contextual header actions, bordered fixed-layout table",
  },
  {
    slug: "create-experiment-entry",
    publish: "img/guide/web/create-experiment-entry.webp",
    frame: "desktop",
    route: "/platform/experiments",
    scope: "Experiments overview with the Create Experiment action in the contextual header",
  },
  {
    slug: "organizations-list",
    publish: "img/guide/web/organizations-list.webp",
    frame: "desktop",
    route: "/platform/organizations",
    scope: "Ownership-ranked Organizations overview with member and resource counts",
  },
  {
    slug: "report-issue",
    publish: "img/guide/web/report-issue.webp",
    frame: "desktop",
    route: "/platform",
    scope: "Report bug action in the dashboard welcome card",
  },
  {
    slug: "create-experiment-details",
    publish: "img/guide/web/create-experiment-details.webp",
    frame: "desktop",
    route: "/platform/experiments/new",
    scope: "Details step of the four-step create-experiment wizard",
  },
  {
    slug: "organization-create-visibility",
    publish: "img/guide/web/organization-create-visibility.webp",
    frame: "desktop",
    route: "/platform/organizations",
    async prepare(page) {
      await activate(page, /create organization/i);
      await page.getByLabel(/^name/i).fill("Vallei Field Station");
      await activate(page, /^next$/i);
    },
    scope: "Create-organization wizard, Profile and visibility step, Private selected",
  },
  {
    slug: "organization-members",
    publish: "img/guide/web/organization-members.webp",
    frame: "desktop",
    route: async () => `/platform/organizations/${await organizationId("Canopy Lab")}/members`,
    scope: "Organization Members screen: Members/Invited/Requests segments and the role roster",
  },
  {
    slug: "organization-team",
    publish: "img/guide/web/organization-team.webp",
    frame: "desktop",
    route: async () => `/platform/organizations/${await organizationId("Canopy Lab")}/teams`,
    async prepare(page) {
      await page
        .getByRole("link", { name: /field operations/i })
        .first()
        .click();
      await page.waitForLoadState("networkidle");
      await settle(page, 1500);
    },
    scope: "A team page with its members above what the team can reach",
  },
  {
    slug: "collaborators",
    publish: "img/guide/web/collaborators.webp",
    frame: "desktop",
    route: async () =>
      `/platform/experiments/${await experimentId("Access Showcase Experiment")}/collaborators`,
    scope: "Collaborators tab showing every row kind the access model can produce",
  },
  {
    slug: "experiment-devices",
    publish: "img/guide/web/experiment-devices.webp",
    frame: "desktop",
    // Needs a local experiment whose id matches one that has published data in
    // the dev lakehouse; the seed alone yields an empty roster.
    route: async () => `/platform/experiments/${await experimentId("Ambyte Field Trial")}/devices`,
    featureFlags: ["iot-devices"],
    async prepare(page) {
      await page.getByRole("table").waitFor({ timeout: 60_000 });
      await settle(page, 1500);
    },
    scope: "Experiment Devices tab with onboarded, observed and unregistered devices and its tiles",
  },
  {
    slug: "workbook-design",
    publish: "img/guide/web/workbook-design.webp",
    frame: "desktop",
    route: async () =>
      `/platform/experiments/${await experimentId("[Seed] Winter Wheat Phenotyping")}/design`,
    scope: "Experiment Design tab with its linked workbook and field-flow cells",
  },
  {
    slug: "sidebar-peek",
    publish: "img/chrome-refresh/sidebar-peek.webp",
    frame: "desktop",
    route: "/platform",
    async prepare(page) {
      await activate(page, /toggle sidebar|collapse sidebar/i);
      // The strip peeks on mouseenter, so the pointer must arrive from outside
      // it; the default (0, 0) already sits inside. The resize rail covers the
      // strip past x=1, which leaves x=0 as the only reachable target.
      await page.mouse.move(900, 600);
      await page.mouse.move(0, 600, { steps: 8 });
      await settle(page, 1200);
    },
    scope: "Collapsed sidebar peeking open on hover",
  },
  {
    slug: "command-palette",
    publish: "img/chrome-refresh/command-palette.webp",
    frame: "desktop",
    route: "/platform",
    async prepare(page) {
      await page.keyboard.press("ControlOrMeta+k");
      await settle(page, 1200);
    },
    scope: "Command palette open over the dashboard",
  },
  {
    slug: "cheatsheet",
    publish: "img/chrome-refresh/cheatsheet.webp",
    frame: "desktop",
    route: "/platform",
    async prepare(page) {
      await page.keyboard.press("Shift+Slash");
      await settle(page, 1200);
    },
    scope: "Keyboard shortcut cheatsheet",
  },
  {
    slug: "activity-bell",
    publish: "img/chrome-refresh/activity-bell.webp",
    frame: "desktop",
    route: "/platform",
    async prepare(page) {
      await activate(page, /^activity$/i);
    },
    scope: "Activity feed opened from the sidebar",
  },
  {
    slug: "login-signup",
    publish: "img/guide/web/login-signup.webp",
    frame: "desktop",
    route: "/login",
    anonymous: true,
    scope: "Log in or sign up screen with email, GitHub, ORCID and passkey sign-in",
  },

  // --------------------------------------- tier 2: transfers, blockers, embargo
  {
    slug: "visibility-embargo",
    publish: "img/guide/web/visibility-embargo.webp",
    frame: "desktop",
    route: "/platform/experiments/new",
    async prepare(page) {
      await page.getByLabel(/^name/i).fill("Vallei Drought Gradient 2027");
      await activate(page, /^next$/i);
      await page.getByRole("combobox").first().click();
      await settle(page, 600);
      await page
        .getByRole("option", { name: /private/i })
        .first()
        .click();
      await settle(page, 1400);
    },
    scope: "Collaborators and Visibility step with Private selected and its embargo end date",
  },
  {
    slug: "resource-transfer",
    publish: "img/guide/web/resource-transfer.webp",
    frame: "desktop",
    // An organization-owned resource, so the destination list carries the
    // separately grouped Personal workspace option the page describes.
    route: async () => `/platform/workbooks/${await workbookId(ORG_OWNED_WORKBOOK)}`,
    async prepare(page) {
      await activate(page, /^transfer$/i);
      await page.getByRole("combobox").first().click();
      await settle(page, 1200);
    },
    scope: "Transfer dialog with its destination list open, including Personal workspace",
  },
  {
    slug: "project-transfer",
    publish: "img/guide/web/project-transfer.webp",
    frame: "desktop",
    route: "/platform/transfer-request",
    async prepare(page) {
      await page
        .getByText(/photosynq project id/i)
        .first()
        .scrollIntoViewIfNeeded();
      await settle(page, 900);
    },
    scope: "The blank Request Project Transfer form",
  },
  {
    slug: "project-transfer-history",
    publish: "img/guide/web/project-transfer-history.webp",
    frame: "desktop",
    route: "/platform/transfer-request/history",
    scope: "Previous Requests tab before any project transfer has been submitted",
  },
  {
    slug: "delete-account-blockers",
    publish: "img/guide/web/delete-account-blockers.webp",
    frame: "desktop",
    route: "/platform/account",
    async prepare(page) {
      await activate(page, /^delete account$/i);
      await settle(page, 1400);
    },
    scope: "Delete Account dialog blocked by sole organization ownership, action disabled",
  },

  // ----------------------------------------------- tier 3: the workbook editor
  {
    slug: "ux-sidebar",
    publish: "img/workbooks/ux-sidebar.webp",
    frame: "desktop",
    route: async () => `/platform/workbooks/${await workbookId(SEED_WORKBOOK)}`,
    scope: "Workbook editor with the block outline beside the cell list",
  },
  {
    slug: "protocol-picker",
    publish: "img/guide/web/protocol-picker.webp",
    frame: "desktop",
    route: async () => `/platform/workbooks/${await protocolWorkbookId()}`,
    async prepare(page) {
      await page
        .getByRole("button", { name: /^protocol$/i })
        .last()
        .click();
      await settle(page, 1800);
      const search = page.getByPlaceholder(/search/i).last();
      if (await search.isVisible().catch(() => false)) await typeInto(search, "chloro");
      await settle(page, 1400);
    },
    scope: "The searchable protocol picker with names, sensor families and preferred badges",
  },
  {
    slug: "ux-question",
    publish: "img/workbooks/ux-question.webp",
    frame: "desktop",
    route: async () => `/platform/workbooks/${await protocolWorkbookId()}`,
    async prepare(page) {
      await page
        .getByRole("button", { name: /^question$/i })
        .last()
        .click();
      await settle(page, 1800);
    },
    scope: "A question cell being authored in the workbook editor",
  },
  {
    slug: "ux-rename",
    publish: "img/workbooks/ux-rename.webp",
    frame: "desktop",
    route: async () => `/platform/workbooks/${await workbookId(SEED_WORKBOOK)}`,
    async prepare(page) {
      await page
        .getByRole("button", { name: /^rename$/i })
        .first()
        .click();
      await settle(page, 1400);
    },
    scope: "Renaming a workbook cell so downstream ctx references stay readable",
  },
  {
    slug: "workbook-ux-improvements",
    publish: "img/workbooks/workbook-ux-improvements.webm",
    frame: "desktop",
    route: async () => `/platform/workbooks/${await workbookId(SEED_WORKBOOK)}`,
    async perform(page) {
      await page
        .getByRole("button", { name: /^rename$/i })
        .first()
        .click();
      await settle(page, 1600);
      await page.keyboard.press("Escape");
      await settle(page, 1000);
      await page
        .getByRole("button", { name: /^question$/i })
        .last()
        .click();
      await settle(page, 2200);
      await page.mouse.wheel(0, 450);
      await settle(page, 1800);
    },
    tailSeconds: 2,
    scope: "Cell rename, adding a question cell, and the block outline tracking both",
  },

  // ------------------------------------------------- tier 4: account security
  {
    slug: "passkeys-table",
    publish: "img/guide/web/account-security/passkeys-table.webp",
    frame: "desktop",
    route: "/platform/account/security",
    webauthn: true,
    async prepare(page) {
      await removeExistingRows(page);
      await activate(page, /create passkey|add passkey/i);
      await settle(page, 3500);
      // Registration lands as "Unnamed passkey"; the row's edit control is what
      // gives it the name a reader would recognise.
      const edit = page.getByRole("button", { name: /rename|edit/i }).last();
      if (await edit.isVisible().catch(() => false)) {
        await edit.click();
        await settle(page, 900);
        await page.getByRole("textbox").last().fill("Field laptop");
        await page
          .getByRole("button", { name: /^rename$/i })
          .last()
          .click();
        await settle(page, 2500);
      }
    },
    scope: "Passkeys listed on the Security tab after one has been registered",
  },
  {
    slug: "api-keys-table",
    publish: "img/guide/web/account-security/api-keys-table.webp",
    frame: "desktop",
    route: "/platform/account/api-keys",
    async prepare(page) {
      await removeExistingRows(page);
      await activate(page, /create api key/i);
      await settle(page, 1400);
      const name = page.getByRole("textbox").first();
      if (await name.isVisible().catch(() => false)) {
        await name.fill("Field laptop");
        await activate(page, /^(create|generate|save)/i);
        await settle(page, 3000);
      }
      // The creation dialog shows the secret exactly once. Close it through its
      // own control and refuse to capture until it is gone; Escape is not
      // enough, and a screenshot taken with it open would publish the key.
      await activate(page, /^(done|close|i have copied)/i);
      await settle(page, 1500);
      await page.reload({ waitUntil: "networkidle" });
      await settle(page, 1500);
      await assertNoSecretVisible(page);
    },
    scope: "API keys tab listing an active key; the one-time secret is never captured",
  },
  {
    slug: "last-used-badge",
    publish: "img/guide/web/account-security/last-used-badge.webp",
    frame: "desktop",
    route: "/platform",
    // The badge is driven by a cookie the last sign-in wrote, so this shot keeps
    // the seeded session and signs out of it rather than starting anonymous.
    async prepare(page) {
      await page
        .getByRole("button", { name: /seed user/i })
        .first()
        .click();
      await settle(page, 1200);
      await page
        .getByRole("menuitem", { name: /sign out|log out/i })
        .or(page.getByRole("button", { name: /sign out|log out/i }))
        .first()
        .click();
      await page.waitForURL(/\/(login|$)/, { timeout: 20_000 }).catch(() => undefined);
      await page.goto(page.url().replace(/\/[^/]*$/, "/login"), { waitUntil: "networkidle" });
      // Signing out leaves a destructive "Error" toast behind (a request fires
      // against the just-ended session and 401s). It does not auto-dismiss, so
      // close it the way a reader would rather than hide it with CSS.
      await settle(page, 2500);
      await dismissToasts(page);
      await settle(page, 1200);
    },
    scope: "Login page with the Last used badge on the previously used sign-in method",
  },
  {
    slug: "passkey-flows",
    publish: "img/guide/web/account-security/passkey-flows.webm",
    frame: "desktop",
    route: "/platform/account/security",
    webauthn: true,
    async prepare(page) {
      await removeExistingRows(page);
    },
    async perform(page) {
      await activate(page, /create passkey|add passkey/i);
      await settle(page, 3500);
      const edit = page.getByRole("button", { name: /rename|edit/i }).last();
      if (await edit.isVisible().catch(() => false)) {
        await edit.click();
        await settle(page, 1000);
        await typeInto(page.getByRole("textbox").last(), "Field laptop");
        await settle(page, 800);
        await page
          .getByRole("button", { name: /^rename$/i })
          .last()
          .click();
      }
      await settle(page, 2500);
    },
    tailSeconds: 2,
    scope: "Registering a passkey with a platform authenticator, then naming it",
  },
  {
    slug: "workbook-version-history",
    publish: "img/guide/web/workbook-version-history.webp",
    frame: "desktop",
    route: async () => `/platform/workbooks/${await workbookId(SEED_WORKBOOK)}`,
    async prepare(page) {
      // The seed fixture ships a single version, so publish once more to give
      // the history something to be a history of.
      await activate(page, /^publish/i).catch(() => undefined);
      await settle(page, 2500);
      await activate(page, /^(publish|confirm)/i).catch(() => undefined);
      await settle(page, 2500);
      await activate(page, /version history|^v\d/i).catch(() => undefined);
      await settle(page, 2000);
    },
    scope: "Workbook version history with the current and an earlier published version",
  },
];

export const SHOTS_BY_SLUG = new Map(SHOTS.map((shot) => [shot.slug, shot]));

/** Playwright reaches the virtual authenticator only through raw CDP. */
export async function enableVirtualAuthenticator(session: CDPSession): Promise<void> {
  await session.send("WebAuthn.enable");
  await session.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      automaticPresenceSimulation: true,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      protocol: "ctap2",
      transport: "internal",
    },
  });
}
