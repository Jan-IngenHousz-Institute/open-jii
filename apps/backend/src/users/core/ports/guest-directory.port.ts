export const GUEST_DIRECTORY_PORT = Symbol("GUEST_DIRECTORY_PORT");

export interface GuestDirectoryPort {
  findGuestIds(userIds: string[]): Promise<string[]>;
}
