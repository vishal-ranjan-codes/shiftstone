import fs from 'node:fs';
import path from 'node:path';
import type { ContextSynthesizerOptions, SynthesizedContext } from './types.js';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function synthesizeWorkerContext(options: ContextSynthesizerOptions): SynthesizedContext {
  const maxTokens = options.maxTokens ?? 4500;
  const suite = options.suite;
  const phaseId = options.phaseId;
  const mode = options.mode || 'implement';
  const readTargets = options.readTargets || [];
  const acceptanceCriteria = options.acceptanceCriteria || [];
  const testScenarios = options.testScenarios || [];

  // Try loading base template from disk if not provided
  let template = options.customPromptTemplate;
  if (!template) {
    const templatePath = path.resolve(
      process.cwd(),
      '.agents/skills/ss-execute-plan/resources/implementer-prompt.md'
    );
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf8');
    }
  }

  const sections: string[] = [];

  if (template) {
    sections.push(template.trim());
  } else {
    sections.push('# Implementer Subagent Prompt (Unit Execution)');
    sections.push(
      'You are the **Implementer Subagent** executing a single Plan Unit in the ShiftStone AI-Native Workspace.'
    );
  }

  sections.push(`\n## Active Assignment: Phase ${phaseId}`);
  sections.push(`- **Plan Suite:** \`${suite}\``);
  sections.push(`- **Target Phase:** \`${phaseId}\``);
  sections.push(`- **Execution Mode:** \`${mode}\``);

  if (readTargets.length > 0) {
    sections.push('\n### Bounded readTargets (Context Ceiling <= 4,500 tokens)');
    for (const target of readTargets) {
      sections.push(`- \`${target}\``);
    }
  }

  if (acceptanceCriteria.length > 0) {
    sections.push('\n### Target Acceptance Criteria');
    for (const ac of acceptanceCriteria) {
      sections.push(`- \`${ac}\``);
    }
  }

  if (testScenarios.length > 0) {
    sections.push('\n### Active Test Scenarios');
    for (const ts of testScenarios) {
      sections.push(`- \`${ts}\``);
    }
  }

  sections.push(`\n### Required Execution Commands`);
  sections.push(`1. \`node .shiftstone/scripts/plan.js resume ${suite} --phase ${phaseId}\``);
  sections.push(`2. \`node .shiftstone/scripts/plan.js begin ${suite} --phase ${phaseId}\``);
  sections.push(`3. Red-First TDD: Author test, observe failure, implement minimal code.`);
  sections.push(`4. \`node .shiftstone/scripts/plan.js verify ${suite} --phase ${phaseId}\``);
  sections.push(`5. \`node .shiftstone/scripts/plan.js close ${suite} --phase ${phaseId}\``);

  const fullPrompt = sections.join('\n');
  const tokenEstimate = estimateTokens(fullPrompt);

  if (tokenEstimate > maxTokens) {
    throw new Error(
      `CONTEXT_LIMIT_EXCEEDED: Synthesized worker prompt estimate (${tokenEstimate} tokens) exceeds maximum allowance of ${maxTokens} tokens`
    );
  }

  return {
    prompt: fullPrompt,
    tokenEstimate,
    readTargets: [...readTargets],
    acceptanceCriteria: [...acceptanceCriteria],
    testScenarios: [...testScenarios],
  };
}
