import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildDashboardMetadata,
  buildDeviceMetadata,
  buildExperimentMetadata,
  buildMacroMetadata,
  buildProtocolMetadata,
  buildProtocolRunMetadata,
  buildVisualizationMetadata,
  buildWorkbookMetadata,
  joinTitleParts,
  TITLE_SEPARATOR,
} from "./platform-metadata";

const remote = vi.hoisted(() => ({
  getExperimentAccess: vi.fn(),
  getExperimentVisualization: vi.fn(),
  getExperimentDashboard: vi.fn(),
  getMacro: vi.fn(),
  getProtocol: vi.fn(),
  getWorkbook: vi.fn(),
  getIotDevice: vi.fn(),
}));

// The global test setup stubs initTranslations to an identity `t`; these title
// builders are specifically about localized output, so use the real loader here.
vi.mock("@repo/i18n/server", async () => await vi.importActual("@repo/i18n/server"));

vi.mock("./server-orpc", () => ({
  createServerOrpcClient: vi.fn(() => ({
    experiments: {
      getExperimentAccess: remote.getExperimentAccess,
      getExperimentVisualization: remote.getExperimentVisualization,
      getExperimentDashboard: remote.getExperimentDashboard,
    },
    macros: { getMacro: remote.getMacro },
    protocols: { getProtocol: remote.getProtocol },
    workbooks: { getWorkbook: remote.getWorkbook },
    iot: { getIotDevice: remote.getIotDevice },
  })),
}));

const EN = "en-US";
const DE = "de-DE";
const EXPERIMENT = { name: "Photosynthesis Run", status: "active" };

beforeEach(() => {
  vi.clearAllMocks();
  remote.getExperimentAccess.mockResolvedValue({ experiment: EXPERIMENT });
});

describe("joinTitleParts", () => {
  it("drops blank segments, trims, and joins with the middot separator", () => {
    expect(joinTitleParts(["Data", null, "  ", "Run"])).toBe(`Data${TITLE_SEPARATOR}Run`);
    expect(TITLE_SEPARATOR).toBe(" · ");
  });
});

describe("experiment titles", () => {
  it("uses the recognizable experiment name for the overview", async () => {
    const { title } = await buildExperimentMetadata({ locale: EN, id: "e1" });
    expect(title).toBe("Photosynthesis Run");
  });

  it("composes a localized section label before the experiment name", async () => {
    const { title } = await buildExperimentMetadata({ locale: EN, id: "e1", section: "data" });
    expect(title).toBe("Data · Photosynthesis Run");
  });

  it("localizes the section label for de-DE", async () => {
    const { title } = await buildExperimentMetadata({ locale: DE, id: "e1", section: "data" });
    expect(title).toBe("Daten · Photosynthesis Run");
  });

  it("appends an Archived marker so active and archived titles differ", async () => {
    const active = await buildExperimentMetadata({ locale: EN, id: "e1" });
    const archived = await buildExperimentMetadata({ locale: EN, id: "e1", archived: true });
    expect(archived.title).toBe("Photosynthesis Run · Archived");
    expect(archived.title).not.toBe(active.title);
  });

  it("marks archived sections distinctly", async () => {
    const { title } = await buildExperimentMetadata({
      locale: EN,
      id: "e1",
      section: "data",
      archived: true,
    });
    expect(title).toBe("Data · Photosynthesis Run · Archived");
  });

  it("falls back to a generic localized noun when the experiment is inaccessible", async () => {
    remote.getExperimentAccess.mockRejectedValue(new Error("403"));
    const overview = await buildExperimentMetadata({ locale: EN, id: "e1" });
    const section = await buildExperimentMetadata({ locale: EN, id: "e1", section: "data" });
    expect(overview.title).toBe("Experiment");
    // A section with no accessible entity surfaces only its own safe label.
    expect(section.title).toBe("Data");
    expect(overview.title).not.toContain("Photosynthesis");
  });
});

describe("visualization and dashboard detail titles", () => {
  it("composes visualization name before experiment name", async () => {
    remote.getExperimentVisualization.mockResolvedValue({ name: "Chart A" });
    const { title } = await buildVisualizationMetadata({
      locale: EN,
      experimentId: "e1",
      visualizationId: "v1",
    });
    expect(title).toBe("Chart A · Photosynthesis Run");
  });

  it("degrades to the section noun when the visualization is missing", async () => {
    remote.getExperimentVisualization.mockRejectedValue(new Error("404"));
    const { title } = await buildVisualizationMetadata({
      locale: EN,
      experimentId: "e1",
      visualizationId: "v1",
      archived: true,
    });
    expect(title).toBe("Visualizations · Photosynthesis Run · Archived");
  });

  it("composes dashboard name before experiment name", async () => {
    remote.getExperimentDashboard.mockResolvedValue({ name: "Board A" });
    const { title } = await buildDashboardMetadata({
      locale: EN,
      experimentId: "e1",
      dashboardId: "d1",
    });
    expect(title).toBe("Board A · Photosynthesis Run");
  });
});

describe("macro / protocol / workbook titles", () => {
  it("uses the entity name, falling back to a localized noun", async () => {
    remote.getMacro.mockResolvedValue({ name: "My Macro" });
    remote.getProtocol.mockResolvedValue({ name: "My Protocol" });
    remote.getWorkbook.mockResolvedValue({ name: "My Workbook" });
    expect((await buildMacroMetadata({ locale: EN, id: "m1" })).title).toBe("My Macro");
    expect((await buildProtocolMetadata({ locale: EN, id: "p1" })).title).toBe("My Protocol");
    expect((await buildWorkbookMetadata({ locale: EN, id: "w1" })).title).toBe("My Workbook");

    remote.getMacro.mockRejectedValue(new Error("404"));
    remote.getProtocol.mockRejectedValue(new Error("404"));
    remote.getWorkbook.mockRejectedValue(new Error("404"));
    expect((await buildMacroMetadata({ locale: EN, id: "m1" })).title).toBe("Macro");
    expect((await buildProtocolMetadata({ locale: EN, id: "p1" })).title).toBe("Protocol");
    expect((await buildWorkbookMetadata({ locale: EN, id: "w1" })).title).toBe("Workbook");
  });

  it("composes the shared collaborators label before the entity name", async () => {
    remote.getMacro.mockResolvedValue({ name: "My Macro" });
    remote.getProtocol.mockResolvedValue({ name: "My Protocol" });
    remote.getWorkbook.mockResolvedValue({ name: "My Workbook" });
    const section = { section: "collaborators" } as const;
    expect((await buildMacroMetadata({ locale: EN, id: "m1", ...section })).title).toBe(
      "Collaborators · My Macro",
    );
    expect((await buildProtocolMetadata({ locale: EN, id: "p1", ...section })).title).toBe(
      "Collaborators · My Protocol",
    );
    expect((await buildWorkbookMetadata({ locale: EN, id: "w1", ...section })).title).toBe(
      "Collaborators · My Workbook",
    );
    expect((await buildMacroMetadata({ locale: DE, id: "m1", ...section })).title).toBe(
      "Mitwirkende · My Macro",
    );
  });

  it("surfaces only the section label when the entity is inaccessible", async () => {
    remote.getMacro.mockRejectedValue(new Error("403"));
    remote.getProtocol.mockRejectedValue(new Error("403"));
    remote.getWorkbook.mockRejectedValue(new Error("403"));
    const section = { section: "collaborators" } as const;
    expect((await buildMacroMetadata({ locale: EN, id: "m1", ...section })).title).toBe(
      "Collaborators",
    );
    expect((await buildProtocolMetadata({ locale: EN, id: "p1", ...section })).title).toBe(
      "Collaborators",
    );
    expect((await buildWorkbookMetadata({ locale: EN, id: "w1", ...section })).title).toBe(
      "Collaborators",
    );
  });

  it("prefixes the localized runner label for the protocol runner", async () => {
    remote.getProtocol.mockResolvedValue({ name: "My Protocol" });
    expect((await buildProtocolRunMetadata({ locale: EN, id: "p1" })).title).toBe(
      "Connect & Test · My Protocol",
    );
    expect((await buildProtocolRunMetadata({ locale: DE, id: "p1" })).title).toBe(
      "Verbinden & Testen · My Protocol",
    );

    remote.getProtocol.mockRejectedValue(new Error("404"));
    expect((await buildProtocolRunMetadata({ locale: EN, id: "p1" })).title).toBe("Connect & Test");
  });
});

describe("device titles", () => {
  it("prefers the assigned name", async () => {
    remote.getIotDevice.mockResolvedValue({
      id: "dev-1",
      name: "Greenhouse Sensor",
      serialNumber: "SN-123",
      deviceType: "unknown",
    });
    expect((await buildDeviceMetadata({ locale: EN, deviceId: "dev-1" })).title).toBe(
      "Greenhouse Sensor",
    );
  });

  it("falls back to the serial number when no name resolves", async () => {
    remote.getIotDevice.mockResolvedValue({
      id: "dev-1",
      name: null,
      serialNumber: "SN-123",
      deviceType: "unknown",
    });
    expect((await buildDeviceMetadata({ locale: EN, deviceId: "dev-1" })).title).toBe("SN-123");
  });

  it("falls back to the generic localized noun when the device is inaccessible", async () => {
    remote.getIotDevice.mockRejectedValue(new Error("404"));
    expect((await buildDeviceMetadata({ locale: EN, deviceId: "dev-1" })).title).toBe("Device");
  });

  it("composes each tab label from the strip's own copy, before the device", async () => {
    remote.getIotDevice.mockResolvedValue({
      id: "dev-1",
      name: "Greenhouse Sensor",
      serialNumber: "SN-123",
      deviceType: "unknown",
    });
    const titles = await Promise.all(
      (["collaborators", "credentials", "lineage", "monitoring", "onboarding"] as const).map(
        async (section) =>
          (await buildDeviceMetadata({ locale: EN, deviceId: "dev-1", section })).title,
      ),
    );

    expect(titles).toEqual([
      "Collaborators · Greenhouse Sensor",
      "Credentials · Greenhouse Sensor",
      "Lineage · Greenhouse Sensor",
      "Monitoring · Greenhouse Sensor",
      "Onboarding · Greenhouse Sensor",
    ]);
  });

  it("localizes a device tab label for de-DE", async () => {
    remote.getIotDevice.mockResolvedValue({
      id: "dev-1",
      name: "Greenhouse Sensor",
      serialNumber: "SN-123",
      deviceType: "unknown",
    });
    expect(
      (await buildDeviceMetadata({ locale: DE, deviceId: "dev-1", section: "credentials" })).title,
    ).toBe("Anmeldedaten · Greenhouse Sensor");
  });

  it("surfaces only the tab label when the device is inaccessible", async () => {
    remote.getIotDevice.mockRejectedValue(new Error("403"));
    const { title } = await buildDeviceMetadata({
      locale: EN,
      deviceId: "dev-1",
      section: "collaborators",
    });
    expect(title).toBe("Collaborators");
  });
});

describe("brand template contract", () => {
  it("never pre-applies the root brand suffix", async () => {
    remote.getExperimentVisualization.mockResolvedValue({ name: "Chart A" });
    remote.getMacro.mockResolvedValue({ name: "My Macro" });
    const titles = [
      (await buildExperimentMetadata({ locale: EN, id: "e1", section: "data" })).title,
      (await buildVisualizationMetadata({ locale: EN, experimentId: "e1", visualizationId: "v1" }))
        .title,
      (await buildMacroMetadata({ locale: EN, id: "m1" })).title,
    ];
    for (const title of titles) {
      expect(typeof title).toBe("string");
      expect(title as string).not.toContain("openJII");
      expect(title as string).not.toContain("|");
    }
  });
});
