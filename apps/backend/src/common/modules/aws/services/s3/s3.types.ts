export interface IotUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export interface GuestUploadOptions {
  guestContentLength: number;
}
