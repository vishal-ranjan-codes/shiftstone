export { Verifier, type VerifierConfig, type VerifierDeps } from './verifier.ts';
export { runDeterministic } from './l1-deterministic.ts';
export { runRuleBased, parseViolations } from './l2-rule.ts';
export { runFieldTruth } from './l3-field-truth.ts';
export { runLlmJudge } from './l4-llm-judge.ts';
export { runHumanCheckpoint } from './l5-human.ts';
export { newRedGreenProof, markBaseline, markCurrent, assertProven } from './red-green.ts';
