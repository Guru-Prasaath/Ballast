import {
  assertTransition,
  canTransition,
  InvalidJobTransitionError,
  isTerminal,
} from './job-state-machine';

describe('job state machine', () => {
  it('allows the happy path scheduled → ready → running → completed', () => {
    expect(canTransition('scheduled', 'ready')).toBe(true);
    expect(canTransition('ready', 'running')).toBe(true);
    expect(canTransition('running', 'completed')).toBe(true);
  });

  it('allows retry and dead-letter from failed', () => {
    expect(canTransition('failed', 'ready')).toBe(true);
    expect(canTransition('failed', 'dead')).toBe(true);
  });

  it('allows manual replay from dead', () => {
    expect(canTransition('dead', 'ready')).toBe(true);
  });

  it('forbids skipping states', () => {
    expect(canTransition('scheduled', 'running')).toBe(false);
    expect(canTransition('ready', 'completed')).toBe(false);
    expect(canTransition('completed', 'ready')).toBe(false);
  });

  it('treats completed as terminal', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('ready')).toBe(false);
  });

  it('assertTransition throws on an illegal edge', () => {
    expect(() => assertTransition('completed', 'running')).toThrow(
      InvalidJobTransitionError,
    );
    expect(() => assertTransition('ready', 'running')).not.toThrow();
  });
});
