import { computeBackoffMs } from './backoff';

describe('computeBackoffMs', () => {
  const base = { baseDelayMs: 1000, maxDelayMs: 60_000, jitter: false };

  it('fixed backoff ignores the attempt number', () => {
    const p = { ...base, backoff: 'fixed' as const };
    expect(computeBackoffMs(p, 1)).toBe(1000);
    expect(computeBackoffMs(p, 5)).toBe(1000);
  });

  it('linear backoff scales with the attempt', () => {
    const p = { ...base, backoff: 'linear' as const };
    expect(computeBackoffMs(p, 1)).toBe(1000);
    expect(computeBackoffMs(p, 3)).toBe(3000);
  });

  it('exponential backoff doubles each attempt', () => {
    const p = { ...base, backoff: 'exponential' as const };
    expect(computeBackoffMs(p, 1)).toBe(1000);
    expect(computeBackoffMs(p, 2)).toBe(2000);
    expect(computeBackoffMs(p, 4)).toBe(8000);
  });

  it('caps at maxDelayMs', () => {
    const p = { ...base, backoff: 'exponential' as const, maxDelayMs: 5000 };
    expect(computeBackoffMs(p, 10)).toBe(5000);
  });

  it('keeps jitter within [50%, 100%] of the capped delay', () => {
    const p = { ...base, backoff: 'fixed' as const, jitter: true };
    expect(computeBackoffMs(p, 1, () => 0)).toBe(500); // low end
    expect(computeBackoffMs(p, 1, () => 0.999)).toBeCloseTo(1000, -1); // high end
  });
});
