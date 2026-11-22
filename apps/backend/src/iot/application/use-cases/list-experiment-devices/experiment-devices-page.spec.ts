import type { IotDeviceSort } from "@repo/api/domains/iot/iot.schema";

import type {
  ExperimentDeviceEntryDto,
  ExperimentDeviceIdentityDto,
} from "../../../core/models/experiment-device.model";
import { experimentDevicesPage } from "./experiment-devices-page";

function device(
  clientId: string,
  name: string,
  overrides: Partial<ExperimentDeviceIdentityDto> = {},
): ExperimentDeviceEntryDto {
  return {
    device: {
      id: clientId,
      thingName: clientId,
      serialNumber: `serial-${clientId}`,
      name,
      deviceType: "ambyte",
      status: "registered",
      boundExperimentCount: 0,
      ...overrides,
    },
    clientId,
    binding: null,
    connectivity: null,
    lastDataAt: null,
    recentData: null,
    reported: null,
    canView: false,
  };
}

const registered = device("a", "Bench Zebra", { deviceType: "minipar" });
const provisioned = device("b", "Bench Beta", { status: "active" });
const onboarded = device("c", "Bench Alpha", {
  deviceType: "ambit",
  status: "active",
  boundExperimentCount: 1,
});
const revoked = device("d", "Rack Gamma", { status: "revoked" });
const retired = device("e", "Bench Eta", { status: "retired" });
const devices = [retired, revoked, onboarded, registered, provisioned];

const dates = new Map([
  ["a", new Date("2026-10-04")],
  ["b", new Date("2026-10-03")],
  ["c", new Date("2026-10-02")],
  ["d", new Date("2026-10-01")],
  ["e", new Date("2026-10-05")],
]);

const order = [
  { field: "name", ascending: ["c", "b", "e", "a", "d"], descending: ["d", "a", "e", "b", "c"] },
  { field: "status", ascending: ["a", "b", "c", "d", "e"], descending: ["e", "d", "c", "b", "a"] },
  { field: "family", ascending: ["c", "b", "d", "e", "a"], descending: ["a", "b", "d", "e", "c"] },
  {
    field: "registered",
    ascending: ["d", "c", "b", "a", "e"],
    descending: ["e", "a", "b", "c", "d"],
  },
] satisfies { field: IotDeviceSort[number]["field"]; ascending: string[]; descending: string[] }[];

describe("experimentDevicesPage", () => {
  it.each(order)("sorts $field ascending and descending", ({ field, ascending, descending }) => {
    const asc = experimentDevicesPage(devices, dates, {
      page: 1,
      sort: [{ field, direction: "asc" }],
    });
    const desc = experimentDevicesPage(devices, dates, {
      page: 1,
      sort: [{ field, direction: "desc" }],
    });

    expect(asc.items.map(({ clientId }) => clientId)).toEqual(ascending);
    expect(desc.items.map(({ clientId }) => clientId)).toEqual(descending);
  });

  it("counts every status after search and family, even when only one status is selected", () => {
    const page = experimentDevicesPage(devices, dates, {
      page: 1,
      search: " BENCH ",
      family: ["ambyte", "ambit"],
      status: ["onboarded"],
    });
    expect(page.items).toEqual([onboarded]);
    expect(page.pagination.totalCount).toBe(1);
    expect(page.pagination.statusCounts).toEqual({
      registered: 0,
      provisioned: 1,
      onboarded: 1,
      revoked: 0,
      retired: 1,
    });
    expect(page.pagination.summary.total).toBe(5);
  });

  it("returns an explicitly selected off-page device alongside the page", () => {
    const query = { page: 1, pageSize: 1 };
    const offPage = experimentDevicesPage(devices, dates, { ...query, selectedClientId: "a" });
    expect(offPage.items).toEqual([retired]);
    expect(offPage.selected).toBe(registered);

    const onPage = experimentDevicesPage(devices, dates, { ...query, selectedClientId: "e" });
    expect(onPage.selected).toBeUndefined();
  });

  it("returns an empty out-of-range page with the real totals", () => {
    const result = experimentDevicesPage(devices, dates, { page: 99, pageSize: 2 });
    expect(result.items).toEqual([]);
    expect(result.pagination).toMatchObject({ page: 99, totalPages: 3, totalCount: 5 });
  });
});
