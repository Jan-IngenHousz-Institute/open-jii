import { useRegisterIotDevice } from "@/hooks/iot/useRegisterIotDevice/useRegisterIotDevice";
import { useRetireIotDevice } from "@/hooks/iot/useRetireIotDevice/useRetireIotDevice";
import { createIotDevice } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useIotDeviceList } from "./useIotDeviceList";

const statusCounts = { registered: 12, provisioned: 1, onboarded: 14, revoked: 0, retired: 5 };
const page = {
  ...listEnvelope([createIotDevice({ name: "Alpha" })], 1, 2),
  totalCount: 32,
  statusCounts,
};

beforeEach(() => openOnUrl("/platform/devices", ""));

describe("useIotDeviceList", () => {
  it("restores search, filters and sort from a shared URL in its first paged request", async () => {
    const sort = encodeURIComponent(JSON.stringify([{ field: "family", direction: "desc" }]));
    openOnUrl(
      "/platform/devices",
      `q=field&status=registered,onboarded&family=ambyte,mobile&sort=${sort}`,
    );
    const spy = server.mount(contract.iot.listIotDevices, { body: page });
    const { result } = renderHook(() => useIotDeviceList());

    await waitFor(() => expect(result.current.data?.items[0]?.name).toBe("Alpha"));
    expect(spy.calls[0]?.query.page).toBe("1");
    expect(spy.calls[0]?.query.search).toBe("field");
    expect(arrayParam(spy.url, "status")).toEqual(["registered", "onboarded"]);
    expect(arrayParam(spy.url, "family")).toEqual(["ambyte", "mobile"]);
    expect(spy.calls[0]?.query["sort[0][field]"]).toBe("family");
    expect(spy.calls[0]?.query["sort[0][direction]"]).toBe("desc");
    expect(result.current.statusCounts).toEqual(statusCounts);
  });

  it("always sends page and omits blank search and empty filters and sort", async () => {
    const spy = server.mount(contract.iot.listIotDevices, { body: page });
    renderHook(() => useIotDeviceList());
    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0]?.query).toEqual({ page: "1" });
  });

  it.each(["search", "status", "family", "sort"] as const)(
    "returns to page 1 when %s changes",
    async (change) => {
      const spy = server.mount(contract.iot.listIotDevices, { body: page });
      const { result } = renderHook(() => useIotDeviceList());
      await waitFor(() => expect(result.current.data).toBeDefined());
      act(() => result.current.setPage(2));
      await waitFor(() => expect(spy.calls.at(-1)?.query.page).toBe("2"));
      act(() => {
        if (change === "search") result.current.setSearch("Alpha");
        if (change === "status") result.current.setFilter("status", ["registered"]);
        if (change === "family") result.current.setFilter("family", ["ambyte"]);
        if (change === "sort") result.current.toggleSort("registered", false);
      });
      await waitFor(() => expect(spy.calls.at(-1)?.query.page).toBe("1"));
      expect(result.current.page).toBe(1);
      if (change === "search")
        await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("Alpha"));
    },
  );

  it("keeps server counts while selecting a status and cycles sort back to the default", async () => {
    const spy = server.mount(contract.iot.listIotDevices, { body: page });
    const { result } = renderHook(() => useIotDeviceList());
    await waitFor(() => expect(result.current.statusCounts).toEqual(statusCounts));
    act(() => result.current.setFilter("status", ["onboarded"]));
    await waitFor(() => expect(arrayParam(spy.url, "status")).toEqual(["onboarded"]));
    expect(result.current.statusCounts?.registered).toBe(12);
    act(() => result.current.toggleSort("name", false));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][direction]"]).toBe("asc"));
    act(() => result.current.toggleSort("name", false));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][direction]"]).toBe("desc"));
    act(() => result.current.setSort([]));
    await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBeUndefined());
  });

  it("refreshes the paged list after registering and retiring a device", async () => {
    const spy = server.mount(contract.iot.listIotDevices, { body: page });
    const device = createIotDevice();
    server.mount(contract.iot.registerIotDevice, { body: device });
    server.mount(contract.iot.retireIotDevice, { body: { ...device, status: "retired" } });
    const { result } = renderHook(() => ({
      list: useIotDeviceList(),
      register: useRegisterIotDevice(),
      retire: useRetireIotDevice(),
    }));
    await waitFor(() => expect(result.current.list.data).toBeDefined());
    const beforeRegister = spy.callCount;
    await act(() =>
      result.current.register.mutateAsync({ serialNumber: "NEW-SERIAL", deviceType: "ambyte" }),
    );
    expect(spy.callCount).toBeGreaterThan(beforeRegister);
    const beforeRetire = spy.callCount;
    await act(() => result.current.retire.mutateAsync({ deviceId: device.id }));
    expect(spy.callCount).toBeGreaterThan(beforeRetire);
    expect(spy.calls.every((call) => call.query.page === "1")).toBe(true);
  });
});
