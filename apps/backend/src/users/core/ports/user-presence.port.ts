export const USER_PRESENCE_PORT = Symbol("USER_PRESENCE_PORT");

export interface UserPresencePort {
  findExistingIds(userIds: string[]): Promise<string[]>;
}
