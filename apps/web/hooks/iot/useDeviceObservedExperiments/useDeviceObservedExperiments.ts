import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The experiments a device's stored rows claim, from one warehouse scan.
 * `enabled` lets the overview pay for it only where bindings cannot answer
 * (phones bind nowhere, so observation is their whole experiment record).
 */
export const useDeviceObservedExperiments = (
  deviceId: string,
  range: { from: string; to: string },
  options?: { enabled?: boolean },
) =>
  useQuery(
    orpc.iot.listDeviceObservedExperiments.queryOptions({
      input: { deviceId, from: range.from, to: range.to },
      enabled: options?.enabled ?? true,
    }),
  );
