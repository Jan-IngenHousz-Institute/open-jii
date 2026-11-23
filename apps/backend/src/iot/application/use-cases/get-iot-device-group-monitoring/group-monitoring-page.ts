import {
  filterGroupMembers,
  isMemberSilent,
  memberStatus,
  summarizeGroupHealth,
} from "@repo/api/domains/iot/device-group/group-health";
import type {
  GroupMonitoringListQuery,
  IotDeviceGroupMonitoring,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { DEFAULT_PAGE_SIZE } from "@repo/api/shared/listing";
import { presentDevice } from "@repo/api/transforms/device-presentation";

const HEALTH_RANK = { online: 0, offline: 1, unknown: 2, silent: 3 };

export function groupMonitoringPage(
  monitoring: IotDeviceGroupMonitoring,
  query: GroupMonitoringListQuery,
  now: number,
): IotDeviceGroupMonitoring {
  if (query.page === undefined) return monitoring;

  const { page, pageSize = DEFAULT_PAGE_SIZE } = query;
  const { members, pipelineUnavailable } = monitoring;
  const labels = new Map(
    members.map((member) => [
      member.deviceId,
      presentDevice({ name: member.name, id: member.serialNumber, family: member.deviceType })
        .primary,
    ]),
  );
  const matching = filterGroupMembers(
    members,
    { search: query.search ?? "", statuses: query.health ?? [], families: query.family ?? [] },
    pipelineUnavailable,
    now,
    (member) => labels.get(member.deviceId) ?? member.serialNumber,
  );

  const healthRank = (member: (typeof members)[number]) =>
    HEALTH_RANK[isMemberSilent(member, pipelineUnavailable, now) ? "silent" : memberStatus(member)];

  if (query.sort?.length) {
    matching.sort((a, b) => {
      for (const { field, direction } of query.sort ?? []) {
        const compare =
          field === "name"
            ? (labels.get(a.deviceId) ?? "").localeCompare(labels.get(b.deviceId) ?? "")
            : field === "family"
              ? a.deviceType.localeCompare(b.deviceType)
              : healthRank(a) - healthRank(b);
        if (compare !== 0) return direction === "asc" ? compare : -compare;
      }
      return 0;
    });
  }

  const { online, unknown, silent } = summarizeGroupHealth(matching, pipelineUnavailable, now);
  const matchingIds = new Set(matching.map((member) => member.deviceId));
  const isFiltered = matching.length !== members.length;
  const throughput = monitoring.throughput.filter((row) =>
    row.deviceId === null ? !isFiltered : matchingIds.has(row.deviceId),
  );
  const events = monitoring.events.filter((row) =>
    row.deviceId === null ? !isFiltered : matchingIds.has(row.deviceId),
  );
  const firmware = monitoring.firmware.filter(
    (row) => row.deviceId !== null && matchingIds.has(row.deviceId),
  );
  const chartLabels = new Set(
    [...throughput, ...events, ...firmware].flatMap((row) =>
      row.deviceId === null ? [] : [row.deviceId],
    ),
  );
  const offset = (page - 1) * pageSize;

  return {
    ...monitoring,
    members: matching.slice(offset, offset + pageSize),
    throughput,
    events,
    firmware,
    pagination: {
      page,
      pageSize,
      totalCount: matching.length,
      totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
      groupSize: members.length,
      online,
      unknown,
      silent,
      freshest: matching.reduce<string | null>(
        (latest, { lastDataAt }) =>
          lastDataAt !== null && (latest === null || lastDataAt > latest) ? lastDataAt : latest,
        null,
      ),
      labels: Object.fromEntries([...labels].filter(([id]) => chartLabels.has(id))),
    },
  };
}
