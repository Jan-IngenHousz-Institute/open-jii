import { presentDevice } from "@/util/device-presentation";
import type { Metadata } from "next";
import { cache } from "react";

import initTranslations from "@repo/i18n/server";

import { createServerOrpcClient } from "./server-orpc";

/**
 * Server-side title helpers for authenticated `/platform` entity routes.
 *
 * Each route resolves a recognizable, localized title before the root
 * `%s | openJII` template (see `app/layout.tsx`). The fetchers below run under
 * the caller's session (cookie-forwarded, see {@link createServerOrpcClient})
 * and are request-memoized with React `cache`, so the metadata fetch shares a
 * response with any sibling fetch of the same entity in the same request and is
 * never persisted across users. Any failure (403/404/network) resolves to
 * `null`, and callers fall back to a safe generic localized label rather than
 * leaking inaccessible entity data.
 */

/** Middot separator used between title segments (`Section · Entity`). */
export const TITLE_SEPARATOR = " · ";

/** Join present, non-blank segments with {@link TITLE_SEPARATOR}. */
export function joinTitleParts(parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(TITLE_SEPARATOR);
}

/** Trimmed value, or `null` when absent or blank (so callers can `??` a fallback). */
function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// --- request-memoized, session-scoped fetchers (null on any error) ----------

const fetchExperimentSummary = cache(async (id: string) => {
  try {
    const client = await createServerOrpcClient();
    const { experiment } = await client.experiments.getExperimentAccess({ id });
    return experiment;
  } catch {
    return null;
  }
});

const fetchVisualizationSummary = cache(async (experimentId: string, visualizationId: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.experiments.getExperimentVisualization({
      id: experimentId,
      visualizationId,
    });
  } catch {
    return null;
  }
});

const fetchDashboardSummary = cache(async (experimentId: string, dashboardId: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.experiments.getExperimentDashboard({
      id: experimentId,
      dashboardId,
    });
  } catch {
    return null;
  }
});

const fetchMacroSummary = cache(async (id: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.macros.getMacro({ id });
  } catch {
    return null;
  }
});

const fetchProtocolSummary = cache(async (id: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.protocols.getProtocol({ id });
  } catch {
    return null;
  }
});

const fetchWorkbookSummary = cache(async (id: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.workbooks.getWorkbook({ id });
  } catch {
    return null;
  }
});

const fetchDeviceSummary = cache(async (deviceId: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.iot.getIotDevice({ deviceId });
  } catch {
    return null;
  }
});

// --- experiment overview + sections -----------------------------------------

/** Localized experiment section labels, mapped to `t()` keys. */
type ExperimentSection =
  | "overview"
  | "data"
  | "design"
  | "collaborators"
  | "visualizations"
  | "dashboards";

const EXPERIMENT_SECTION_KEY: Record<Exclude<ExperimentSection, "overview">, string> = {
  data: "experiments:data",
  design: "experiments:flow.tabLabel",
  collaborators: "common:experimentSettings.collaborators",
  visualizations: "experiments:analysis.visualizations",
  dashboards: "experiments:dashboards.tabLabel",
};

/**
 * Title for an experiment overview or section route.
 *
 * - overview: `{name}` (or the generic `Experiment` noun when inaccessible)
 * - section: `{Section} · {name}` (or `{Section}` alone when inaccessible)
 * - archived: the localized `Archived` marker is appended so active and
 *   archived tabs are always distinguishable.
 */
export async function buildExperimentMetadata({
  locale,
  id,
  section = "overview",
  archived = false,
}: {
  locale: string;
  id: string;
  section?: ExperimentSection;
  archived?: boolean;
}): Promise<Metadata> {
  const { t } = await initTranslations({
    locale,
    namespaces: ["experiments", "common"],
  });
  const experiment = await fetchExperimentSummary(id);
  const name = nonEmpty(experiment?.name);

  const sectionLabel = section === "overview" ? null : t(EXPERIMENT_SECTION_KEY[section]);
  // Overview falls back to the generic entity noun; sections fall back to their
  // own label so an inaccessible experiment never surfaces as a bare marketing
  // title and never leaks a name.
  const lead = name ?? (section === "overview" ? t("experiments:experiment") : null);
  const archivedLabel = archived ? t("experiments:status.archived") : null;

  return { title: joinTitleParts([sectionLabel, lead, archivedLabel]) };
}

/** Title for a visualization detail route: `{visualization} · {experiment}`. */
export async function buildVisualizationMetadata({
  locale,
  experimentId,
  visualizationId,
  archived = false,
}: {
  locale: string;
  experimentId: string;
  visualizationId: string;
  archived?: boolean;
}): Promise<Metadata> {
  const { t } = await initTranslations({
    locale,
    namespaces: ["experiments", "common"],
  });
  const [experiment, visualization] = await Promise.all([
    fetchExperimentSummary(experimentId),
    fetchVisualizationSummary(experimentId, visualizationId),
  ]);

  // Detail name when available, else degrade to the localized section noun.
  const lead = nonEmpty(visualization?.name) ?? t("experiments:analysis.visualizations");
  const experimentName = nonEmpty(experiment?.name);
  const archivedLabel = archived ? t("experiments:status.archived") : null;

  return { title: joinTitleParts([lead, experimentName, archivedLabel]) };
}

/** Title for a dashboard detail route: `{dashboard} · {experiment}`. */
export async function buildDashboardMetadata({
  locale,
  experimentId,
  dashboardId,
}: {
  locale: string;
  experimentId: string;
  dashboardId: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({
    locale,
    namespaces: ["experiments", "common"],
  });
  const [experiment, dashboard] = await Promise.all([
    fetchExperimentSummary(experimentId),
    fetchDashboardSummary(experimentId, dashboardId),
  ]);

  const lead = nonEmpty(dashboard?.name) ?? t("experiments:dashboards.tabLabel");
  const experimentName = nonEmpty(experiment?.name);

  return { title: joinTitleParts([lead, experimentName]) };
}

// --- macros / protocols / workbooks -----------------------------------------

/** Title for a macro overview route: the macro name, else the generic noun. */
export async function buildMacroMetadata({
  locale,
  id,
}: {
  locale: string;
  id: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["macro"] });
  const macro = await fetchMacroSummary(id);
  return { title: nonEmpty(macro?.name) ?? t("macro:macros.macro") };
}

/** Title for a protocol overview route: the protocol name, else the noun. */
export async function buildProtocolMetadata({
  locale,
  id,
}: {
  locale: string;
  id: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  const protocol = await fetchProtocolSummary(id);
  return { title: nonEmpty(protocol?.name) ?? t("common:protocols.protocol") };
}

/** Title for a protocol runner route: `Connect & Test · {protocol}`. */
export async function buildProtocolRunMetadata({
  locale,
  id,
}: {
  locale: string;
  id: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  const protocol = await fetchProtocolSummary(id);
  const runner = t("common:protocolSettings.testerTitle");
  return { title: joinTitleParts([runner, nonEmpty(protocol?.name)]) };
}

/** Title for a workbook overview route: the workbook name, else the noun. */
export async function buildWorkbookMetadata({
  locale,
  id,
}: {
  locale: string;
  id: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["workbook"] });
  const workbook = await fetchWorkbookSummary(id);
  return { title: nonEmpty(workbook?.name) ?? t("workbook:workbooks.workbook") };
}

// --- devices ----------------------------------------------------------------

/**
 * Title for a device detail route. Prefers the assigned name, then the canonical
 * product name (both via the shared {@link presentDevice} transform), then the
 * serial number as a stable recognizable identifier, and finally the generic
 * localized `Device` noun.
 */
export async function buildDeviceMetadata({
  locale,
  deviceId,
}: {
  locale: string;
  deviceId: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });
  const generic = t("iot:iot.protocolRunner.device");
  const device = await fetchDeviceSummary(deviceId);
  if (!device) {
    return { title: generic };
  }

  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.id,
  });
  const title =
    present.provenance === "fallback"
      ? (nonEmpty(device.serialNumber) ?? generic)
      : present.primary;

  return { title };
}
