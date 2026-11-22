export const GROUP_MONITORING_CACHE = Symbol("GROUP_MONITORING_CACHE");

export interface GroupMonitoringCache {
  tryCache<T>(key: string, load: () => Promise<T>): Promise<T | null>;
}
