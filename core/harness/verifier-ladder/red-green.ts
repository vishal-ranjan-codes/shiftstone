/**
 * A1 — Red-before / green-after verifier-sensitivity proof (Family C).
 *
 * The check must FAIL against the pre-mutation baseline (red) and PASS after
 * the mutation (green). Only then is the verifier proven non-tautological.
 * A tautological check passes everywhere — including against the baseline —
 * so it can never set `proven` and success is refused (RedGreenUnprovenError).
 */

import { RedGreenUnprovenError, type RedGreenProof } from '../loop-runner/types.ts';

export function newRedGreenProof(required: boolean): RedGreenProof {
  return { required, proven: false, baseline: 'unknown', current: 'unknown' };
}

/** Record the verifier reading against the pre-mutation baseline. */
export function markBaseline(proof: RedGreenProof, baselinePassed: boolean): void {
  proof.baseline = baselinePassed ? 'green' : 'red';
}

/** Record the verifier reading after the mutation; red→green proves sensitivity. */
export function markCurrent(proof: RedGreenProof, currentPassed: boolean): void {
  proof.current = currentPassed ? 'green' : 'red';
  if (proof.baseline === 'red' && proof.current === 'green') {
    proof.proven = true;
  }
}

/** Success may not be declared while a required proof is unproven. */
export function assertProven(proof: RedGreenProof, loopName: string): void {
  if (proof.required && !proof.proven) {
    throw new RedGreenUnprovenError(
      `Loop ${loopName}: red-before/green-after unproven — the check never failed ` +
        `against the pre-mutation baseline, so it may be tautological. Refusing success.`,
    );
  }
}
