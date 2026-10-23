import { describe, expect, it } from 'vitest';
import {
  IllegalTransitionError,
  InvariantViolation,
  StateMachine,
  isTerminal,
} from '../../harness/terminal-state-machine/state.ts';

function sm(): StateMachine {
  return new StateMachine({
    success: 'done',
    no_op: 'nothing to do',
    blocked: 'human needed',
    stalled: 'no progress',
    exhausted: 'budget gone',
  });
}

describe('StateMachine transitions (§7.7 diagram)', () => {
  it('walks the happy path idle → triggered → precheck → execute → verify → success', () => {
    const m = sm();
    expect(m.current).toBe('idle');
    m.transition('triggered');
    m.transition('precheck');
    m.transition('execute');
    m.transition('verify');
    const exit = m.exit('success', { verified: true });
    expect(m.current).toBe('success');
    expect(exit.description).toBe('done');
    expect(m.isTerminal()).toBe(true);
  });

  it('covers every allowed edge', () => {
    const edges: Array<[Parameters<StateMachine['transition']>[0], Parameters<StateMachine['transition']>[0]]> = [
      ['idle', 'triggered'],
      ['triggered', 'precheck'],
      ['triggered', 'error'],
      ['precheck', 'execute'],
      ['precheck', 'exhausted'],
      ['precheck', 'blocked'],
      ['precheck', 'error'],
      ['execute', 'verify'],
      ['execute', 'blocked'],
      ['execute', 'exhausted'],
      ['execute', 'error'],
      ['verify', 'success'],
      ['verify', 'execute'],
      ['verify', 'precheck'],
      ['verify', 'stalled'],
      ['verify', 'blocked'],
      ['verify', 'exhausted'],
      ['verify', 'error'],
    ];
    for (const [from, to] of edges) {
      const m = sm();
      const path = ['triggered', 'precheck', 'execute', 'verify'] as const;
      for (const step of path) {
        if (m.current === from) break;
        if (m.canTransition(step)) m.transition(step);
      }
      expect(m.current, `${from} should be reachable`).toBe(from);
      expect(m.canTransition(to), `${from} → ${to}`).toBe(true);
      expect(m.transition(to)).toBe(to);
    }
  });

  it('precheck → no_op and precheck → success (streak confirmation) are allowed', () => {
    const m = sm();
    m.transition('triggered');
    m.transition('precheck');
    expect(m.canTransition('no_op')).toBe(true);
    expect(m.exit('no_op').state).toBe('no_op');

    const m2 = sm();
    m2.transition('triggered');
    m2.transition('precheck');
    expect(m2.canTransition('success')).toBe(true);
  });

  it('throws IllegalTransitionError on forbidden edges', () => {
    const m = sm();
    expect(() => m.transition('execute')).toThrow(IllegalTransitionError);
    m.transition('triggered');
    expect(() => m.transition('verify')).toThrow(/Illegal state transition: triggered → verify/);
  });

  it('all terminal states are absorbing (no exit from a terminal)', () => {
    for (const terminal of ['success', 'no_op', 'blocked', 'stalled', 'exhausted', 'error'] as const) {
      const m = sm();
      m.transition('triggered');
      m.transition('precheck');
      if (terminal === 'no_op') {
        m.exit(terminal, { verified: false });
      } else {
        m.transition('execute');
        m.transition('verify');
        m.exit(terminal, { verified: terminal === 'success' });
      }
      expect(isTerminal(terminal)).toBe(true);
      for (const to of ['triggered', 'precheck', 'execute', 'verify', 'success', 'error'] as const) {
        expect(m.canTransition(to), `${terminal} → ${to} must be illegal`).toBe(false);
      }
      expect(() => m.exit('success', { verified: true })).toThrow(IllegalTransitionError);
    }
  });
});

describe('hard invariants', () => {
  it('exit("success") without verified proof throws (error ≠ success, exhausted ≠ success)', () => {
    const m = sm();
    m.transition('triggered');
    m.transition('precheck');
    expect(() => m.exit('success')).toThrow(InvariantViolation);
    expect(() => m.exit('success', { verified: false })).toThrow(/exhausted ≠ success/);
  });

  it('exhausted can never become success', () => {
    const m = sm();
    m.transition('triggered');
    m.transition('precheck');
    m.exit('exhausted', { verified: false });
    expect(() => m.exit('success', { verified: true })).toThrow(IllegalTransitionError);
  });

  it('error can never become success', () => {
    const m = sm();
    m.transition('triggered');
    m.exit('error', { verified: false });
    expect(() => m.exit('success', { verified: true })).toThrow(IllegalTransitionError);
  });

  it('records transition history', () => {
    const m = sm();
    m.transition('triggered');
    m.transition('precheck');
    m.exit('no_op');
    expect(m.history.map((h) => h.to)).toEqual(['triggered', 'precheck', 'no_op']);
  });
});
