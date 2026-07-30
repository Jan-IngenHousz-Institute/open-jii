import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { locales } from "@repo/i18n/config";
import deCommon from "@repo/i18n/locales/de-DE/common.json";

import { generateMetadata as generateApiKeysMetadata } from "./account/api-keys/page";
import { generateMetadata as generateAccountMetadata } from "./account/page";
import { generateMetadata as generateSecurityMetadata } from "./account/security/page";
import { generateMetadata as generateDevicesMetadata } from "./devices/page";
import { generateMetadata as generateExperimentsArchiveMetadata } from "./experiments-archive/page";
import { generateMetadata as generateNewExperimentMetadata } from "./experiments/new/page";
import { generateMetadata as generateExperimentsMetadata } from "./experiments/page";
import { generateMetadata as generateNewMacroMetadata } from "./macros/new/page";
import { generateMetadata as generateMacrosMetadata } from "./macros/page";
import { generateMetadata as generatePlatformMetadata } from "./page";
import { generateMetadata as generateNewProtocolMetadata } from "./protocols/new/page";
import { generateMetadata as generateProtocolsMetadata } from "./protocols/page";
import { generateMetadata as generateTransferHistoryMetadata } from "./transfer-request/history/page";
import { generateMetadata as generateTransferRequestMetadata } from "./transfer-request/page";
import { generateMetadata as generateWorkbooksMetadata } from "./workbooks/page";

const platformDirectory = dirname(fileURLToPath(import.meta.url));
const ROOT_MARKETING_TITLE = "openJII - Open-science platform";

const redirectOnlyRoutes = {
  "experiments/[id]/analysis/page.tsx": "redirects to the active experiment visualizations list",
  "experiments-archive/[id]/analysis/page.tsx":
    "redirects to the archived experiment visualizations list",
} as const;

// These helpers have focused runtime coverage in lib/platform-metadata.test.ts.
const testedPlatformTitleBuilders = new Set([
  "buildDashboardMetadata",
  "buildDeviceMetadata",
  "buildExperimentMetadata",
  "buildMacroMetadata",
  "buildProtocolMetadata",
  "buildProtocolRunMetadata",
  "buildVisualizationMetadata",
  "buildWorkbookMetadata",
]);

function findPageRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) return findPageRoutes(path);
    if (entry.name !== "page.tsx") return [];

    return relative(platformDirectory, path).split(sep).join("/");
  });
}

function isExported(node: ts.Node): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function isTitleProperty(property: ts.ObjectLiteralElementLike): boolean {
  if (!property.name) return false;

  return (
    (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
    property.name.text === "title"
  );
}

function returnsOwnedTitle(body: ts.FunctionBody): boolean {
  let ownsTitle = false;

  function visit(node: ts.Node) {
    if (ownsTitle) return;

    if (ts.isReturnStatement(node) && node.expression) {
      const expression = unwrapExpression(node.expression);

      if (ts.isObjectLiteralExpression(expression) && expression.properties.some(isTitleProperty)) {
        ownsTitle = true;
        return;
      }

      function findTestedBuilder(child: ts.Node) {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          testedPlatformTitleBuilders.has(child.expression.text)
        ) {
          ownsTitle = true;
          return;
        }

        if (!ownsTitle) ts.forEachChild(child, findTestedBuilder);
      }

      findTestedBuilder(expression);
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return ownsTitle;
}

function ownsTitleMetadata(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "page.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  return sourceFile.statements.some((statement) => {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      return statement.declarationList.declarations.some((declaration) => {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "metadata")
          return false;
        if (!declaration.initializer) return false;

        const initializer = unwrapExpression(declaration.initializer);
        return (
          ts.isObjectLiteralExpression(initializer) && initializer.properties.some(isTitleProperty)
        );
      });
    }

    return (
      ts.isFunctionDeclaration(statement) &&
      isExported(statement) &&
      statement.name?.text === "generateMetadata" &&
      Boolean(statement.body && returnsOwnedTitle(statement.body))
    );
  });
}

describe("platform metadata ownership inventory", () => {
  const pageRoutes = findPageRoutes(platformDirectory).sort();

  it("covers all 36 current page routes", () => {
    expect(pageRoutes).toHaveLength(36);
  });

  it.each(pageRoutes)("gives %s title ownership or a documented redirect exception", (route) => {
    const source = readFileSync(resolve(platformDirectory, route), "utf8");
    if (route in redirectOnlyRoutes) {
      const redirectReason = redirectOnlyRoutes[route as keyof typeof redirectOnlyRoutes];
      expect(redirectReason).not.toHaveLength(0);
      expect(source).toMatch(/import\s*\{\s*redirect\s*\}\s*from\s*["']next\/navigation["']/u);
      expect(source).toMatch(/\bredirect\s*\(/u);
      expect(ownsTitleMetadata(source)).toBe(false);
      return;
    }

    expect(
      ownsTitleMetadata(source),
      `${route} must return a title or delegate to a tested platform title builder`,
    ).toBe(true);
    expect(source).not.toMatch(/openJII/iu);
    expect(source).not.toContain(ROOT_MARKETING_TITLE);
  });

  it("keeps the redirect-only exception list in sync with discovered routes", () => {
    expect(Object.keys(redirectOnlyRoutes).sort()).toEqual(
      pageRoutes.filter(
        (route) => !ownsTitleMetadata(readFileSync(resolve(platformDirectory, route), "utf8")),
      ),
    );
  });
});

describe("title ownership source guard", () => {
  it.each([
    ["static metadata", `export const metadata = { robots: { index: false } };`],
    [
      "generated metadata",
      `export function generateMetadata() { return { robots: { index: false } }; }`,
    ],
  ])("rejects robots-only %s", (_case, source) => {
    expect(ownsTitleMetadata(source)).toBe(false);
  });

  it.each([
    ["static title", `export const metadata = { title: "Devices" };`],
    [
      "translated generated title",
      `export async function generateMetadata() { return { title: t("devices.title") }; }`,
    ],
    [
      "tested title builder delegation",
      `export function generateMetadata() {
        return safeMetadata(async () => buildExperimentMetadata({ locale: "en-US", id: "1" }));
      }`,
    ],
  ])("accepts %s", (_case, source) => {
    expect(ownsTitleMetadata(source)).toBe(true);
  });
});

const { translations } = vi.hoisted(() => ({
  translations: {
    "en-US": {
      "account:apiKeys.title": "API keys",
      "account:security.title": "Security",
      "account:tabs.general": "General",
      "common:experiments.archiveTitle": "Experiments Archive",
      "common:experiments.newExperiment": "New Experiment",
      "common:experiments.title": "Experiments",
      "common:protocols.newProtocol": "New Protocol",
      "common:protocols.title": "Protocols",
      "common:transferRequest.title": "Request Project Transfer",
      "common:transferRequest.yourRequests": "Your Transfer Requests",
      "dashboard:title": "Dashboard",
      "iot:iot.devices.title": "Devices",
      "macro:macros.newMacro": "New Macro",
      "macro:macros.title": "Macros",
      "workbook:workbooks.title": "Workbooks",
    },
    "de-DE": {
      "account:apiKeys.title": "API-Schlüssel",
      "account:security.title": "Sicherheit",
      "account:tabs.general": "Allgemein",
      "common:experiments.archiveTitle": "Experiment-Archiv",
      "common:experiments.newExperiment": "Neues Experiment",
      "common:experiments.title": "Experimente",
      "common:protocols.newProtocol": "Neues Protokoll",
      "common:protocols.title": "Protokolle",
      "common:transferRequest.title": "Projekttransfer beantragen",
      "common:transferRequest.yourRequests": "Ihre Transferanfragen",
      "dashboard:title": "Dashboard",
      "iot:iot.devices.title": "Geräte",
      "macro:macros.newMacro": "Neues Makro",
      "macro:macros.title": "Makros",
      "workbook:workbooks.title": "Arbeitsmappen",
    },
  } as const,
}));

vi.mock("@repo/i18n/server", () => ({
  default: vi.fn(({ locale, namespaces }: { locale: string; namespaces: readonly [string] }) => {
    const selectedLocale = locale in translations ? (locale as keyof typeof translations) : "en-US";
    const namespace = namespaces[0];

    return Promise.resolve({
      t: (key: string) => {
        const translationKey = `${namespace}:${key}`;
        const localized = translations[selectedLocale] as Partial<Record<string, string>>;
        const fallback = translations["en-US"] as Partial<Record<string, string>>;
        return localized[translationKey] ?? fallback[translationKey] ?? key;
      },
    });
  }),
}));

const routes = [
  ["dashboard", generatePlatformMetadata],
  ["account", generateAccountMetadata],
  ["security", generateSecurityMetadata],
  ["apiKeys", generateApiKeysMetadata],
  ["devices", generateDevicesMetadata],
  ["experiments", generateExperimentsMetadata],
  ["newExperiment", generateNewExperimentMetadata],
  ["experimentsArchive", generateExperimentsArchiveMetadata],
  ["macros", generateMacrosMetadata],
  ["newMacro", generateNewMacroMetadata],
  ["protocols", generateProtocolsMetadata],
  ["newProtocol", generateNewProtocolMetadata],
  ["workbooks", generateWorkbooksMetadata],
  ["transferRequest", generateTransferRequestMetadata],
  ["transferHistory", generateTransferHistoryMetadata],
] as const;

const expectedTitles: Record<
  (typeof locales)[number],
  Record<(typeof routes)[number][0], string>
> = {
  "en-US": {
    dashboard: "Dashboard",
    account: "General",
    security: "Security",
    apiKeys: "API keys",
    devices: "Devices",
    experiments: "Experiments",
    newExperiment: "New Experiment",
    experimentsArchive: "Experiments Archive",
    macros: "Macros",
    newMacro: "New Macro",
    protocols: "Protocols",
    newProtocol: "New Protocol",
    workbooks: "Workbooks",
    transferRequest: "Request Project Transfer",
    transferHistory: "Your Transfer Requests",
  },
  "de-DE": {
    dashboard: "Dashboard",
    account: "Allgemein",
    security: "Sicherheit",
    apiKeys: "API-Schlüssel",
    devices: "Geräte",
    experiments: "Experimente",
    newExperiment: "Neues Experiment",
    experimentsArchive: "Experiment-Archiv",
    macros: "Makros",
    newMacro: "Neues Makro",
    protocols: "Protokolle",
    newProtocol: "Neues Protokoll",
    workbooks: "Arbeitsmappen",
    transferRequest: "Projekttransfer beantragen",
    transferHistory: "Ihre Transferanfragen",
  },
};

async function getTitles(locale: string) {
  const entries = await Promise.all(
    routes.map(async ([route, generateMetadata]) => {
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

      if (typeof metadata.title !== "string") {
        throw new TypeError(`Expected a string title for ${route}`);
      }

      return [route, metadata.title] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<(typeof routes)[number][0], string>;
}

describe("localized static platform metadata", () => {
  it.each(locales)("uses visible UI labels for %s", async (locale) => {
    await expect(getTitles(locale)).resolves.toEqual(expectedTitles[locale]);
  });

  it("falls back without throwing for an unsupported locale parameter", async () => {
    await expect(getTitles("not-a-configured-locale")).resolves.toEqual(expectedTitles["en-US"]);
  });

  it("reads the German transfer titles from the real common resource", () => {
    expect(deCommon.transferRequest).toMatchObject({
      title: "Projekttransfer beantragen",
      yourRequests: "Ihre Transferanfragen",
    });
  });

  it.each(locales)(
    "returns unbranded page titles instead of the marketing fallback for %s",
    async (locale) => {
      const titles = Object.values(await getTitles(locale));

      for (const title of titles) {
        expect(title).not.toMatch(/openJII/iu);
        expect(title).not.toContain("|");
        expect(title).not.toBe(ROOT_MARKETING_TITLE);
      }
    },
  );
});
