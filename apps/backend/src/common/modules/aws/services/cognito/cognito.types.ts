export interface OpenIdTokenResult {
  identityId: string;
  token: string;
}

export interface IotCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}
