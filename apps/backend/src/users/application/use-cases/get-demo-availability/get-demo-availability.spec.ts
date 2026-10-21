import { GetDemoAvailabilityUseCase } from "./get-demo-availability";

describe("demo availability cache", () => {
  afterEach(() => vi.useRealTimers());

  it.each([true, false])("coalesces requests and expires %s at thirty seconds", async (enabled) => {
    vi.useFakeTimers();
    const isEnabled = vi.fn().mockResolvedValue(enabled);
    const useCase = new GetDemoAvailabilityUseCase({ isEnabled });
    const results = await Promise.all([useCase.execute(), useCase.execute(), useCase.execute()]);
    expect(results).toEqual([{ enabled }, { enabled }, { enabled }]);
    expect(isEnabled).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(29_999);
    await useCase.execute();
    expect(isEnabled).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    isEnabled.mockResolvedValue(!enabled);
    expect(await useCase.execute()).toEqual({ enabled: !enabled });
    expect(isEnabled).toHaveBeenCalledTimes(2);
  });

  it("fails closed, caches the failure and retries at the same deadline", async () => {
    vi.useFakeTimers();
    const isEnabled = vi.fn().mockRejectedValue(new Error("unavailable"));
    const useCase = new GetDemoAvailabilityUseCase({ isEnabled });
    expect(await useCase.execute()).toEqual({ enabled: false });
    await useCase.execute();
    expect(isEnabled).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    isEnabled.mockResolvedValue(true);
    expect(await useCase.execute()).toEqual({ enabled: true });
  });
});
