import { RecentChecks } from "./recent-checks";

describe("RecentChecks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives everyone who asks within the window the first answer", async () => {
    const checks = new RecentChecks(5_000);
    const check = vi.fn(() => Promise.resolve(true));

    const answers = await Promise.all([checks.ask("a", check), checks.ask("a", check)]);
    vi.advanceTimersByTime(4_999);
    const later = await checks.ask("a", check);

    expect([...answers, later].map(({ isTrue }) => isTrue)).toEqual([true, true, true]);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("says when the check behind a shared answer began, so a caller can tell its age", async () => {
    const checks = new RecentChecks(5_000);
    const check = vi.fn(() => Promise.resolve(true));

    const first = await checks.ask("a", check);
    vi.advanceTimersByTime(3_000);
    const shared = await checks.ask("a", check);

    expect(shared.askedAt).toBe(first.askedAt);
    expect(Date.now() - shared.askedAt).toBe(3_000);
  });

  it("asks again once the window has passed, and asks each question on its own", async () => {
    const checks = new RecentChecks(5_000);
    const check = vi.fn(() => Promise.resolve(false));

    await checks.ask("a", check);
    await checks.ask("b", check);
    vi.advanceTimersByTime(5_000);
    await checks.ask("a", check);

    expect(check).toHaveBeenCalledTimes(3);
  });

  it("asks again after a check that failed", async () => {
    const checks = new RecentChecks(5_000);
    const check = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("database unreachable"))
      .mockResolvedValue(true);

    await expect(checks.ask("a", check)).rejects.toThrow("database unreachable");

    await expect(checks.ask("a", check)).resolves.toMatchObject({ isTrue: true });
    expect(check).toHaveBeenCalledTimes(2);
  });
});
