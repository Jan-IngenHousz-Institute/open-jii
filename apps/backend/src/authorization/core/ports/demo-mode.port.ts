export const DEMO_MODE_PORT = Symbol("DEMO_MODE_PORT");

export interface DemoModePort {
  isEnabled(): Promise<boolean>;
}
