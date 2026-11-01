export const SIGNED_OUT = "signed-out";

interface SessionState {
  data: { user: { id: string } } | null;
  isPending: boolean;
  error?: unknown;
}

// A pending session or a failed refetch says nothing new about who is signed in.
export function settledIdentity({ data, isPending, error }: SessionState) {
  if (isPending || error) return undefined;
  return data?.user.id ?? SIGNED_OUT;
}
