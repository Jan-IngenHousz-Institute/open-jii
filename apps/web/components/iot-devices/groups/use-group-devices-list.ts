"use client";

import { useResourceList } from "@/hooks/useResourceList";
import { z } from "zod";

import type { IotDeviceGroupMemberHealth } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { zDeviceType } from "@repo/api/domains/iot/iot.schema";
import { zListSort } from "@repo/api/shared/listing";

import { filterGroupMembers, isMemberSilent, memberStatus } from "./group-health";

const FILTERS = {
  groupHealth: z.enum(["online", "offline", "unknown", "silent"]),
  deviceFamily: zDeviceType,
};
const HEALTH_RANK = { online: 0, offline: 1, unknown: 2, silent: 3 };
const SORT = zListSort(z.enum(["name", "health", "family"]));
const EMPTY_MEMBERS: IotDeviceGroupMemberHealth[] = [];

export function useGroupDevicesList({
  groupId,
  dataUpdatedAt,
  members = EMPTY_MEMBERS,
  labelByDeviceId,
  pipelineUnavailable,
  now,
}: {
  groupId: string;
  dataUpdatedAt: number;
  members?: IotDeviceGroupMemberHealth[];
  labelByDeviceId: Map<string, string>;
  pipelineUnavailable: boolean;
  now: number;
}) {
  const labelFor = (member: IotDeviceGroupMemberHealth) =>
    labelByDeviceId.get(member.deviceId) ?? member.serialNumber;
  const healthFor = (member: IotDeviceGroupMemberHealth) =>
    isMemberSilent(member, pipelineUnavailable, now) ? "silent" : memberStatus(member);
  const list = useResourceList({
    searchKey: "q",
    filters: FILTERS,
    sort: SORT,
    query: (view) => ({
      queryKey: ["group-devices-list", groupId, dataUpdatedAt],
      queryFn: () => members,
      initialData: members,
      staleTime: Infinity,
      select: (rows: IotDeviceGroupMemberHealth[]) => {
        const matching = filterGroupMembers(
          rows,
          {
            search: view.search,
            statuses: view.filters.groupHealth,
            families: view.filters.deviceFamily,
          },
          pipelineUnavailable,
          now,
          labelFor,
        );
        if (view.sort.length === 0) return matching;
        return matching.sort((a, b) => {
          for (const { field, direction } of view.sort) {
            const compare =
              field === "name"
                ? labelFor(a).localeCompare(labelFor(b))
                : field === "family"
                  ? a.deviceType.localeCompare(b.deviceType)
                  : HEALTH_RANK[healthFor(a)] - HEALTH_RANK[healthFor(b)];
            if (compare !== 0) return direction === "asc" ? compare : -compare;
          }
          return 0;
        });
      },
    }),
  });
  const matchingMembers = filterGroupMembers(
    members,
    {
      search: list.debouncedSearch,
      statuses: list.filters.groupHealth,
      families: list.filters.deviceFamily,
    },
    pipelineUnavailable,
    now,
    labelFor,
  );
  return { ...list, matchingMembers };
}

export type GroupDevicesList = ReturnType<typeof useGroupDevicesList>;
