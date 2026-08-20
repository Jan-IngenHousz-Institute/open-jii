import { createIotDeviceDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import type * as xyflowReact from "@xyflow/react";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceLineagePage, { generateMetadata } from "../page";

// ReactFlow's real canvas leaks post-teardown timers in jsdom (the reason the
// flow-editor suite stubs it too); this stub still renders every node through
// `nodeTypes`, so node content and click-to-select stay real behavior.
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual("@xyflow/react");
  const ReactFlow = ({ nodes = [], nodeTypes, onNodeClick }: xyflowReact.ReactFlowProps) => (
    <div data-testid="rf">
      {nodes.map((node) => {
        const NodeComponent = nodeTypes?.[node.type ?? ""];
        if (NodeComponent === undefined) {
          return null;
        }
        const nodeProps = {
          id: node.id,
          data: node.data,
          selected: node.selected ?? false,
        } as unknown as xyflowReact.NodeProps;
        return (
          <div key={node.id} onClick={(event) => onNodeClick?.(event, node)}>
            <NodeComponent {...nodeProps} />
          </div>
        );
      })}
    </div>
  );
  return {
    ...(actual as Record<string, unknown>),
    ReactFlow,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
  };
});

vi.mock("@/lib/platform-metadata", () => ({
  buildDeviceMetadata: vi.fn(({ deviceId, section }: { deviceId: string; section: string }) => ({
    title: `${section}:${deviceId}`,
  })),
}));

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("generateMetadata", () => {
  it("titles the route by its lineage section", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", deviceId: DEVICE_ID }),
    });

    expect(metadata.title).toBe(`lineage:${DEVICE_ID}`);
  });
});

describe("DeviceLineagePage", () => {
  it("renders the live lineage surface", async () => {
    vi.mocked(useParams).mockReturnValue({ deviceId: DEVICE_ID });
    server.mount(contract.iot.getIotDevice, { body: createIotDeviceDetail({ id: DEVICE_ID }) });
    server.mount(contract.iot.getIotDeviceActivity, {
      body: { lastDataAt: null, pipelineUnavailable: false },
    });
    server.mount(contract.iot.listDeviceExperiments, { body: [] });
    server.mount(contract.iot.getDeviceMonitoring, {
      body: {
        bucket: "day",
        events: [],
        sessions: [],
        uptimePercent: null,
        truncated: false,
        throughput: [],
        battery: [],
        payload: {
          totalMeasurements: 0,
          withGps: 0,
          withBattery: 0,
          workbookRuns: 0,
          firmwareMix: [],
          protocolMix: [],
          workbookMix: [],
          macroMix: [],
        },
        firmwareHistory: [],
        recentMeasurements: [],
      },
    });

    render(<DeviceLineagePage />);

    expect(await screen.findByText("iot.devices.lineage.title")).toBeInTheDocument();
    expect(await screen.findByText("iot.devices.lineage.brokerTitle")).toBeInTheDocument();
  });
});
