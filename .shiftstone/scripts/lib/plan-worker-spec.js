import fs from 'node:fs';
import path from 'node:path';
import { normalizeSuite, resolveRepoPath } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';
import { resumePhase } from './plan-resume.js';
import { renderPlanProgressTable } from './plan-progress.js';

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Extracts acceptance criteria lines (AC-*) and test scenarios (TS-*) from contract content.
 */
export function extractCriteriaAndTests(content) {
  const criteria = [];
  const tests = [];
  if (!content) return { criteria, tests };

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/\bAC-U\d+-\d+\b/.test(trimmed)) {
      criteria.push(trimmed.replace(/^[-*]\s*/, ''));
    } else if (/\bTS-U\d+-\d+\b/.test(trimmed)) {
      tests.push(trimmed.replace(/^[-*]\s*/, ''));
    }
  }

  return { criteria, tests };
}

/**
 * Generates an immutable, bounded SubagentInvocationSpec for an Ephemeral Worker.
 * Enforces <= 4,500 token ceiling and structured lifecycle commands.
 */
export function generateWorkerSpec(root, suite, phaseId, options = {}) {
  const normSuite = normalizeSuite(root, suite);
  const maxTokens = options.maxTokens ?? 4500;

  // 1. Resume phase to evaluate readiness, turnMode, and bounded readTargets
  const resumeResult = resumePhase(root, normSuite, phaseId, options);
  if (resumeResult.exitCode !== 0) {
    return {
      success: false,
      exitCode: resumeResult.exitCode || 1,
      error: resumeResult.diagnostics?.[0]?.message || `Prerequisites not ready for phase ${phaseId}`,
    };
  }

  // 2. Validate plan and locate target phase
  const plan = validatePlan(root, normSuite);
  if (plan.status !== 'valid') {
    return {
      success: false,
      exitCode: 1,
      error: `Invalid plan suite: ${plan.diagnostics.map((d) => d.message).join('; ')}`,
    };
  }

  const phase = (plan.manifest?.phases || []).find((p) => p.phaseId === phaseId);
  if (!phase) {
    return {
      success: false,
      exitCode: 1,
      error: `Phase ${phaseId} not found in manifest`,
    };
  }

  // 3. Extract Acceptance Criteria and Test Scenarios
  let criteria = [];
  let tests = [];

  if (phase.contract) {
    try {
      const contractFull = resolveRepoPath(root, phase.contract, { mustExist: false });
      if (fs.existsSync(contractFull)) {
        const contractContent = fs.readFileSync(contractFull, 'utf8');
        const extracted = extractCriteriaAndTests(contractContent);
        criteria = extracted.criteria;
        tests = extracted.tests;
      }
    } catch (_) {}
  }

  if (criteria.length === 0) {
    criteria = (phase.checks || []).flatMap((c) => c.acceptanceIds || []).map((id) => `\`${id}\``);
  }

  // 4. Load base template
  let template = options.customPromptTemplate;
  if (!template) {
    const templatePath = path.resolve(
      root,
      '.agents/skills/ss-execute-plan/resources/implementer-prompt.md'
    );
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf8');
    }
  }

  const sections = [];
  if (template) {
    sections.push(template.trim());
  } else {
    sections.push('# Implementer Subagent Prompt (Unit Execution)');
    sections.push(
      'You are the **Implementer Subagent** executing a single Plan Unit in the ShiftStone AI-Native Workspace.'
    );
  }

  sections.push(`\n## Active Assignment: Phase ${phaseId}`);
  sections.push(`- **Plan Suite:** \`${normSuite}\``);
  sections.push(`- **Target Phase:** \`${phaseId}\``);
  sections.push(`- **Execution Mode:** \`${resumeResult.mode || 'implement'}\``);

  if (phase.sourcePaths && phase.sourcePaths.length > 0) {
    sections.push('\n### Approved Target Files');
    for (const p of phase.sourcePaths) {
      sections.push(`- \`${p}\``);
    }
  }

  const approvalsDir = path.resolve(root, '.shiftstone', 'governance', 'approvals');
  if (fs.existsSync(approvalsDir)) {
    try {
      const approvalFiles = fs.readdirSync(approvalsDir).filter((f) => f.endsWith('.json'));
      for (const f of approvalFiles) {
        const full = path.join(approvalsDir, f);
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (data.status === 'active' || data.status === 'approved') {
          const covers = (phase.sourcePaths || []).some((sp) => {
            const norm = sp.replace(/\\/g, '/').replace(/^\.\//, '');
            return data.scopePaths?.some((p) => p === '**' || p === '.' || norm === p || norm.startsWith(`${p}/`));
          });
          if (covers) {
            sections.push(`\n### Active Governance Approval Reference`);
            sections.push(`- Approval ID: \`${data.approvalId}\` (${data.actionClass})`);
            sections.push(`  Include in output facts JSON under \`approvalRefs\` if modifying protected paths.`);
            break;
          }
        }
      }
    } catch (_) {}
  }

  const readTargets = resumeResult.readTargets || [];
  if (readTargets.length > 0) {
    sections.push('\n### Bounded readTargets (Context Ceiling <= 4,500 tokens)');
    for (const target of readTargets) {
      sections.push(`- \`${target}\``);
    }
  }

  if (criteria.length > 0) {
    sections.push('\n### Target Acceptance Criteria');
    for (const ac of criteria) {
      sections.push(`- ${ac}`);
    }
  }

  if (tests.length > 0) {
    sections.push('\n### Active Test Scenarios');
    for (const ts of tests) {
      sections.push(`- ${ts}`);
    }
  }

  sections.push(`\n### Required Execution Commands`);
  sections.push(`1. \`node .shiftstone/scripts/plan.js resume ${normSuite} --phase ${phaseId}\``);
  sections.push(`2. \`node .shiftstone/scripts/agent-preflight.js --suite ${normSuite} --phase ${phaseId}\``);
  sections.push(`3. \`node .shiftstone/scripts/plan.js begin ${normSuite} --phase ${phaseId}\``);
  sections.push(`4. Red Turn: Author failing test scenario(s) in declared test file.`);
  sections.push(`5. Green Turn: Implement minimal production code to satisfy acceptance criteria.`);
  sections.push(`6. \`node .shiftstone/scripts/plan.js verify ${normSuite} --phase ${phaseId}\``);
  sections.push(`7. Completion Receipt: Report created/modified files, verify output, and hand off cleanly to Governor.`);

  sections.push(`\n### Targeted Execution & Test Guidance`);
  sections.push(`- Run focused unit tests during Red/Green turns (e.g. \`pnpm -C .shiftstone vitest run <test-file>\`) rather than whole-repo test suites.`);
  sections.push(`- Modify ONLY declared target files. Do NOT perform unnecessary repository crawling.`);

  const prompt = sections.join('\n');
  const tokenEstimate = estimateTokens(prompt);

  if (tokenEstimate > maxTokens) {
    return {
      success: false,
      exitCode: 1,
      error: `CONTEXT_LIMIT_EXCEEDED: Synthesized worker prompt (${tokenEstimate} tokens) exceeds maximum allowance of ${maxTokens} tokens`,
    };
  }

  const spec = {
    TypeName: 'self',
    Role: `Ephemeral Plan Worker [${phaseId}]`,
    Prompt: prompt,
    Workspace: options.worktree ? 'branch' : 'inherit',
    Model: options.model || 'inherit',
  };

  const progressDashboard = renderPlanProgressTable(root, normSuite, {
    activePhase: phaseId,
    worker: spec.Role,
  });

  return {
    success: true,
    exitCode: 0,
    suiteId: plan.manifest?.suiteId || normSuite,
    phaseId,
    mode: resumeResult.mode,
    tokenEstimate,
    spec,
    progressDashboard,
  };
}
