export interface AuthEmailPort {
  sendVerificationEmail(email: string, url: string): Promise<void>;
}
