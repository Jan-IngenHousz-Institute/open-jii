/** Injected time source; the reducer itself never reads a clock. */
export interface ClockPort {
  now(): number;
}

export const systemClock: ClockPort = {
  now: () => Date.now(),
};
