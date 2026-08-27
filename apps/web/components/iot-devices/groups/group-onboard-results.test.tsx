import { render, screen, userEvent } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IotDeviceGroupOnboardRow } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { GroupOnboardResults } from "./group-onboard-results";

const downloads: string[] = [];

function config(thingName: string, experimentNames: string[] = []) {
  return {
    thingName,
    deviceType: "ambyte" as const,
    endpoint: "data.iot.example.amazonaws.com",
    issuedAt: "2026-08-28T09:00:00.000Z",
    experiments: experimentNames.map((experimentName, index) => ({
      experimentId: `33333333-3333-4333-8333-33333333333${String(index)}`,
      experimentName,
      topicPrefix: "experiment/data_ingest/v1/x/ambyte",
      workbookVersion: null,
      procedures: [],
    })),
  };
}

function row(overrides: Partial<IotDeviceGroupOnboardRow>): IotDeviceGroupOnboardRow {
  return {
    deviceId: "11111111-1111-4111-8111-111111111111",
    config: null,
    error: null,
    ...overrides,
  };
}

function renderResults(rows: IotDeviceGroupOnboardRow[], boundExperimentNames: string[] = []) {
  return render(
    <GroupOnboardResults
      groupName="Field / trial"
      rows={rows}
      labelByDeviceId={new Map([["11111111-1111-4111-8111-111111111111", "Gateway"]])}
      boundExperimentNames={boundExperimentNames}
      answers={{}}
      deliveryBlocked={false}
    />,
  );
}

describe("GroupOnboardResults", () => {
  beforeEach(() => {
    downloads.length = 0;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("narrates the batch and what each device now serves", () => {
    renderResults([row({ config: config("ambyte_GW-1", ["Field trial"]) })], ["Field trial"]);

    expect(screen.getByText("iot.groups.onboarding.boundNote")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.serves")).toBeInTheDocument();
  });

  it("says so when a device serves no live experiments after a re-issue", () => {
    renderResults([row({ config: config("ambyte_GW-1") })]);

    expect(screen.getByText("iot.groups.onboarding.reissuedNote")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.onboarding.servesNothing")).toBeInTheDocument();
  });

  it("downloads a single device's config as its own file", async () => {
    const user = userEvent.setup();
    renderResults([row({ config: config("ambyte_GW-1") })]);

    await user.click(screen.getByRole("button", { name: "iot.groups.onboarding.downloadOne" }));

    expect(downloads).toEqual(["ambyte_GW-1-config.json"]);
  });

  it("zips every success under a filesystem-safe group name", async () => {
    const user = userEvent.setup();
    renderResults([
      row({ config: config("ambyte_GW-1") }),
      row({
        deviceId: "22222222-2222-4222-8222-222222222222",
        error: "no live credentials",
      }),
    ]);

    await user.click(screen.getByRole("button", { name: /iot.groups.onboarding.downloadAll/ }));

    // "Field / trial" sanitized; the failed row contributes nothing to the zip.
    expect(downloads).toEqual(["Field-trial-configs.zip"]);
  });
});
