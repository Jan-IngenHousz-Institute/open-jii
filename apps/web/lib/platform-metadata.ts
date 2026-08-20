import { presentDevice } from "@/util/device-presentation";
import type { Metadata } from "next";
import { cache } from "react";

import initTranslations from "@repo/i18n/server";

import { createServerOrpcClient } from "./server-orpc";

/**
 * Fetches run with the caller's session and are memoized only within that request,
 * so titles can share detail responses without crossing users. Failures fall back
 * to generic localized labels instead of leaking inaccessible entity names.
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

const fetchOrganizationSummary = cache(async (id: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.organizations.getOrganization({ id });
  } catch {
    return null;
  }
});

const fetchOrganizationTeamName = cache(async (organizationId: string, teamId: string) => {
  try {
    const client = await createServerOrpcClient();
    const teams = await client.organizations.listOrganizationTeams({ id: organizationId });
    return teams.find((team) => team.id === teamId)?.name ?? null;
  } catch {
    return null;
  }
});

const fetchDeviceGroupSummary = cache(async (groupId: string) => {
  try {
    const client = await createServerOrpcClient();
    return await client.iot.getIotDeviceGroup({ groupId });
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
  | "dashboards"
  | "devices";

const EXPERIMENT_SECTION_KEY: Record<Exclude<ExperimentSection, "overview">, string> = {
  data: "experiments:data",
  design: "experiments:flow.tabLabel",
  collaborators: "common:experimentSettings.collaborators",
  visualizations: "experiments:analysis.visualizations",
  dashboards: "experiments:dashboards.tabLabel",
  devices: "iot:iot.experimentDevices.tabLabel",
};

/**
 * Inaccessible sections keep their section label without an entity name; archived
 * titles append a marker so active and archived tabs remain distinguishable.
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
    namespaces: ["experiments", "common", "iot"],
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

/**
 * Sections a macro, protocol or workbook detail route can be on. All three share
 * one tab strip component (`components/sharing/resource-detail-tabs.tsx`), so the
 * section labels come from the same shared keys it renders.
 */
type SharedResourceSection = "overview" | "collaborators";

const SHARED_RESOURCE_SECTION_KEY: Record<Exclude<SharedResourceSection, "overview">, string> = {
  collaborators: "common:sharing.collaboratorsTab",
};

/**
 * Title for a macro overview or section route.
 *
 * - overview: `{name}` (or the generic `Macro` noun when inaccessible)
 * - section: `{Section} · {name}` (or `{Section}` alone when inaccessible)
 */
export async function buildMacroMetadata({
  locale,
  id,
  section = "overview",
}: {
  locale: string;
  id: string;
  section?: SharedResourceSection;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["macro", "common"] });
  const macro = await fetchMacroSummary(id);

  const sectionLabel = section === "overview" ? null : t(SHARED_RESOURCE_SECTION_KEY[section]);
  const lead = nonEmpty(macro?.name) ?? (section === "overview" ? t("macro:macros.macro") : null);

  return { title: joinTitleParts([sectionLabel, lead]) };
}

/** Title for a protocol overview or section route; see {@link buildMacroMetadata}. */
export async function buildProtocolMetadata({
  locale,
  id,
  section = "overview",
}: {
  locale: string;
  id: string;
  section?: SharedResourceSection;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  const protocol = await fetchProtocolSummary(id);

  const sectionLabel = section === "overview" ? null : t(SHARED_RESOURCE_SECTION_KEY[section]);
  const lead =
    nonEmpty(protocol?.name) ?? (section === "overview" ? t("common:protocols.protocol") : null);

  return { title: joinTitleParts([sectionLabel, lead]) };
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

/** Title for a workbook overview or section route; see {@link buildMacroMetadata}. */
export async function buildWorkbookMetadata({
  locale,
  id,
  section = "overview",
}: {
  locale: string;
  id: string;
  section?: SharedResourceSection;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["workbook", "common"] });
  const workbook = await fetchWorkbookSummary(id);

  const sectionLabel = section === "overview" ? null : t(SHARED_RESOURCE_SECTION_KEY[section]);
  const lead =
    nonEmpty(workbook?.name) ?? (section === "overview" ? t("workbook:workbooks.workbook") : null);

  return { title: joinTitleParts([sectionLabel, lead]) };
}

// --- organizations ----------------------------------------------------------

/** Localized organization tab labels, mapped to `t()` keys (the strip's own copy). */
type OrganizationSection = "overview" | "members" | "teams" | "settings";

const ORGANIZATION_SECTION_KEY: Record<Exclude<OrganizationSection, "overview">, string> = {
  members: "common:organizations.tabs.members",
  teams: "common:organizations.tabs.teams",
  settings: "common:organizations.tabs.settings",
};

/**
 * Title for an organization overview or section route.
 *
 * - overview: `{name}` (or the generic `Organization` noun when inaccessible)
 * - section: `{Section} · {name}` (or `{Section}` alone when inaccessible)
 *
 * A private organization answers 404 for a non-member, so an inaccessible one
 * yields no name — which is the point: the title must not disclose that an
 * organization with that id exists.
 */
export async function buildOrganizationMetadata({
  locale,
  id,
  section = "overview",
  teamId,
}: {
  locale: string;
  id: string;
  section?: OrganizationSection;
  /** A team detail route: its own name leads instead of the section label. */
  teamId?: string;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  const organization = await fetchOrganizationSummary(id);

  const teamName = teamId ? nonEmpty(await fetchOrganizationTeamName(id, teamId)) : null;
  const sectionLabel =
    teamName ?? (section === "overview" ? null : t(ORGANIZATION_SECTION_KEY[section]));
  const lead =
    nonEmpty(organization?.name) ??
    (section === "overview" && !teamName ? t("common:organizations.organization") : null);

  return { title: joinTitleParts([sectionLabel, lead]) };
}

// --- devices ----------------------------------------------------------------

type DeviceSummary = NonNullable<Awaited<ReturnType<typeof fetchDeviceSummary>>>;

/** Localized device tab labels, mapped to `t()` keys (the strip's own copy). */
type DeviceSection =
  | "overview"
  | "collaborators"
  | "credentials"
  | "lineage"
  | "monitoring"
  | "onboarding";

const DEVICE_SECTION_KEY: Record<Exclude<DeviceSection, "overview">, string> = {
  collaborators: "iot:iot.devices.detailTabs.collaborators",
  credentials: "iot:iot.devices.detailTabs.credentials",
  lineage: "iot:iot.devices.detailTabs.lineage",
  monitoring: "iot:iot.devices.detailTabs.monitoring",
  onboarding: "iot:iot.devices.detailTabs.onboarding",
};

/**
 * A device's own recognizable label: the assigned name, then the serial number
 * as the stable identifier, then the canonical product name (all via the shared
 * {@link presentDevice} transform). `null` when nothing identifying resolves.
 */
function deviceIdentity(device: DeviceSummary): string | null {
  const present = presentDevice({
    name: device.name,
    family: device.deviceType,
    id: device.serialNumber,
  });

  return present.provenance === "fallback" ? null : present.primary;
}

/**
 * Title for a device detail overview or section route.
 *
 * - overview: `{device}` (or the generic `Device` noun when unidentifiable)
 * - section: `{Section} · {device}` (or `{Section}` alone when unidentifiable)
 */
export async function buildDeviceMetadata({
  locale,
  deviceId,
  section = "overview",
}: {
  locale: string;
  deviceId: string;
  section?: DeviceSection;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });
  const device = await fetchDeviceSummary(deviceId);

  const sectionLabel = section === "overview" ? null : t(DEVICE_SECTION_KEY[section]);
  const identity = device ? deviceIdentity(device) : null;
  // Overview falls back to the generic entity noun; sections fall back to their
  // own label so an inaccessible device never surfaces as a bare marketing title
  // and never leaks a name.
  const lead = identity ?? (section === "overview" ? t("iot:iot.protocolRunner.device") : null);

  return { title: joinTitleParts([sectionLabel, lead]) };
}

// --- device groups ----------------------------------------------------------

/** Group tab labels reuse the device strip's copy (the strips are twins). */
type DeviceGroupSection =
  | "overview"
  | "collaborators"
  | "credentials"
  | "monitoring"
  | "onboarding";

const DEVICE_GROUP_SECTION_KEY: Record<Exclude<DeviceGroupSection, "overview">, string> = {
  collaborators: "iot:iot.devices.detailTabs.collaborators",
  credentials: "iot:iot.devices.detailTabs.credentials",
  monitoring: "iot:iot.devices.detailTabs.monitoring",
  onboarding: "iot:iot.devices.detailTabs.onboarding",
};

/** Title for a device-group overview or section route; see {@link buildDeviceMetadata}. */
export async function buildDeviceGroupMetadata({
  locale,
  groupId,
  section = "overview",
}: {
  locale: string;
  groupId: string;
  section?: DeviceGroupSection;
}): Promise<Metadata> {
  const { t } = await initTranslations({ locale, namespaces: ["iot"] });
  const group = await fetchDeviceGroupSummary(groupId);

  const sectionLabel = section === "overview" ? null : t(DEVICE_GROUP_SECTION_KEY[section]);
  const lead =
    nonEmpty(group?.name) ?? (section === "overview" ? t("iot:iot.groups.pageTitle") : null);

  return { title: joinTitleParts([sectionLabel, lead]) };
}
