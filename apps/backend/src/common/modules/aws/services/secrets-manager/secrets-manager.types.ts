export interface CachedSecret {
  value: Record<string, unknown>;
  fetchedAt: number;
}

export interface DatabaseCredentials {
  username: string;
  password: string;
}
