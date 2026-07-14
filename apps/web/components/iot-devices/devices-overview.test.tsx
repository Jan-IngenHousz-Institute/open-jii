import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DevicesOverview } from "./devices-overview";

describe("DevicesOverview", () => {
  it("summarizes devices by status", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [
        createIotDevice({ status: "active" }),
        createIotDevice({ status: "active" }),
        createIotDevice({ status: "pending" }),
        createIotDevice({ status: "revoked" }),
      ],
    });

    render(<DevicesOverview />);

    // Counts load asynchronously; 4 total and 2 active are both unique on screen.
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.overview.total")).toBeInTheDocument();
  });
});
