/**
 * L5 — Human checkpoint: blocks until the user explicitly approves.
 * Assisted zone. A denial escalates (blocked), it never counts as success.
 */

import type {
  HumanApprovalPort,
  VerifyOpts,
  VerifyResult,
} from '../loop-runner/types.ts';

export interface HumanLevelConfig {
  command?: string;
}

export async function runHumanCheckpoint(
  config: HumanLevelConfig,
  opts: VerifyOpts,
  port: HumanApprovalPort | undefined,
  loopName: string,
): Promise<VerifyResult> {
  if (!port) {
    return {
      passed: false,
      blocked: true,
      reason: `L5 human checkpoint not configured for loop ${loopName} — escalate to a human.`,
      evidence: { human_port_configured: false },
      zone: 'assisted',
    };
  }
  const approved = await port.approve({
    message: `Loop ${loopName} reached human gate. Approve?`,
    artifact: opts.artifact,
  });
  return {
    passed: approved,
    blocked: !approved,
    reason: approved ? undefined : 'human checkpoint denied — escalate',
    evidence: { approval: approved },
    zone: 'assisted',
  };
}
