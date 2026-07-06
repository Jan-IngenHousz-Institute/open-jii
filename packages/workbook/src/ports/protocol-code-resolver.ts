export interface ProtocolCodeResolverPort {
  /** Resolve a protocol cell's id to instruction blocks; null when unknown. */
  resolveProtocolCode(
    protocolId: string,
    version?: number,
  ): Promise<Record<string, unknown>[] | null>;
}
