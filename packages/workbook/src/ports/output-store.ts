/**
 * Optional storage for large producer outputs. Live state always holds inline
 * values; the snapshot layer offloads to this store (entries become {ref})
 * and restore inflates them back. Without a store, snapshots stay inline.
 */
export interface OutputStorePort {
  put(key: string, data: unknown): Promise<string>;
  get(ref: string): Promise<unknown>;
}
