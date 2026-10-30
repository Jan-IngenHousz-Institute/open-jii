export interface IotUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export interface SignedDownloadUrl {
  url: string;
  expiresAt: Date;
}

export interface GuestUploadOptions {
  guestContentLength: number;
}
