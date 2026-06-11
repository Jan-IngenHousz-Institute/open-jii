// Canonical keys for server content that is both queried by feature hooks
// and prefetched for offline use. The offline prefetcher must write the
// exact keys the hooks read, so every consumer goes through this builder.
export const contentKeys = {
  experiments: ["experiments"] as const,
  // Id-keyed keys are also built while their query is disabled (id not yet
  // known), hence the undefined-tolerant params.
  experimentFlow: (experimentId: string | undefined) => ["experiment-flow", experimentId] as const,
  protocol: (protocolId: string | undefined) => ["protocol", protocolId] as const,
  macro: (macroId: string | undefined) => ["macro", macroId] as const,
  userProfile: (userId: string | undefined) => ["userProfile", userId] as const,
} as const;
