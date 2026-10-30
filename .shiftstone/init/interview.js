/**
 * Interactive archetype composition interview (blueprint section 5.4).
 *
 * Runs when init is invoked without --archetype/--archetypes/--validate.
 * Keeps the pre-refactor question flow (project name, layout, package
 * manager, GitHub user, starter clone, extra skills) and adds archetype
 * selection as the first question.
 */

import readline from 'node:readline';
import { listPackNames, loadPack } from './pack-loader.js';
import { DEFAULT_ARCHETYPE } from './compose.js';

/**
 * @param {{ root?: string, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} [options]
 * @returns {Promise<Record<string, any>>} raw interview answers
 */
export async function interview(options = {}) {
  const root = options.root;
  const rl = readline.createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });
  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    const packNames = listPackNames(root ?? process.cwd());
    const answers = {};

    if (packNames.length > 0) {
      console.log('Select your Stack Archetype:');
      packNames.forEach((name, index) => {
        let label = name;
        try {
          const pack = loadPack(root ?? process.cwd(), name);
          const tier = pack.manifest?.metadata?.tier ?? 'community';
          const display = pack.manifest?.metadata?.displayName ?? name;
          label = `${display} (${name}, ${tier})`;
        } catch {
          /* keep directory name */
        }
        console.log(` ${index + 1}) ${label}`);
      });
      const defaultIndex = Math.max(packNames.indexOf(DEFAULT_ARCHETYPE), 0);
      const choice = await ask(
        `👉 Enter choice (1-${packNames.length}) [Default: ${defaultIndex + 1}]: `,
      );
      const parsed = parseInt(choice.trim(), 10);
      const picked =
        Number.isFinite(parsed) && parsed >= 1 && parsed <= packNames.length
          ? packNames[parsed - 1]
          : packNames[defaultIndex];
      answers.archetypes = picked;
    }

    answers.projectName = (await ask('❓ Enter your Project Name (e.g. AcmeSaaS): ')).trim() || 'MySaaSApp';

    console.log('\nSelect your Project Layout Style:');
    console.log(' 1) Monorepo (apps/<app> + root documentation & governance) [Recommended]');
    console.log(' 2) Standard Single App (app in root)');
    const layoutChoice = await ask('👉 Enter Choice (1-2) [Default: 1]: ');
    answers.layout = layoutChoice.trim() === '2' ? 'single' : 'monorepo';

    console.log('\nSelect package manager:');
    console.log(' 1) pnpm [Recommended]');
    console.log(' 2) npm');
    console.log(' 3) yarn');
    const pmChoice = await ask('👉 Enter Choice (1-3) [Default: 1]: ');
    answers.packageManager =
      pmChoice.trim() === '2' ? 'npm' : pmChoice.trim() === '3' ? 'yarn' : 'pnpm';

    const ghUser = await ask('\nGitHub Username / Org (or press Enter to configure later): ');
    answers.ghUser = ghUser.trim() || null;

    if (answers.archetypes?.includes(DEFAULT_ARCHETYPE)) {
      const cloneChoice = await ask(
        '\nStarter Boilerplate Setup: clone the official starter into the app folder? (y/n) [Default: y]: ',
      );
      answers.cloneStarter = !cloneChoice.trim().toLowerCase().startsWith('n');
    }

    const skillsInput = await ask(
      '\nAdditional Project Integrations/Skills (comma-separated, optional): ',
    );
    answers.skills = skillsInput.trim() || null;

    return answers;
  } finally {
    rl.close();
  }
}

/**
 * Conversational opening greeting welcoming pre-existing PRDs without multiple-choice confinement.
 */
export const OPENING_GREETING = `Welcome to ShiftStone! Tell me about what you're dreaming of building. What kind of app or website is it, who is it for, and what problem does it solve for them?

💡 **Have an existing plan?** If you already drafted a PRD or brainstormed with ChatGPT, Claude, Gemini, or have notes from a developer, feel free to paste the entire plan here! I will extract everything you've already decided and skip any questions that are already answered.`;

/**
 * Tech-agnostic tri-archetype catalog for user inspiration.
 */
export const TRI_ARCHETYPES = [
  {
    id: 'marketplace',
    label: 'Local Consumer Marketplace',
    example: 'Booking local tutors or fitness trainers with scheduling, reviews, and client messaging.',
  },
  {
    id: 'b2b_saas',
    label: 'B2B Team SaaS',
    example: 'Team task management, workspace role permissions, and client invoice approval.',
  },
  {
    id: 'ai_tool',
    label: 'AI-Native Developer Tool',
    example: 'Automated audio meeting summarizer with webhook alerts and API keys.',
  },
];

/**
 * Analyzes conversational turn history for context sufficiency.
 * Requires at least 2 key product attributes (target audience, core action, value prop)
 * and at least 20 words.
 *
 * @param {Array<{ role?: string, content?: string }> | string} turnHistory
 * @returns {{ sufficient: boolean, wordCount: number, presentAttributes: string[], missingAttributes: string[], followUpQuestion: string | null }}
 */
export function evaluateContextSufficiency(turnHistory) {
  let combinedText = '';
  if (Array.isArray(turnHistory)) {
    combinedText = turnHistory
      .filter((t) => t && (t.role === 'user' || !t.role))
      .map((t) => (typeof t === 'string' ? t : t.content || ''))
      .join(' ');
  } else if (typeof turnHistory === 'string') {
    combinedText = turnHistory;
  }

  const words = combinedText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = combinedText.toLowerCase();

  const audienceKeywords = [
    'for', 'users', 'clients', 'owners', 'customers', 'members', 'parents',
    'teams', 'groomers', 'tutors', 'agencies', 'freelancers', 'developers',
    'students', 'patients', 'buyers', 'sellers', 'founders', 'subscribers',
  ];
  const hasTargetAudience = audienceKeywords.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );

  const actionKeywords = [
    'book', 'booking', 'manage', 'managing', 'track', 'tracking',
    'streamline', 'streamlines', 'create', 'order', 'generate', 'chat',
    'summarize', 'upload', 'share', 'approve', 'collaborate', 'log',
    'pay', 'schedule', 'review',
  ];
  const hasCoreAction = actionKeywords.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );

  const valueKeywords = [
    'solves', 'problem', 'helps', 'where', 'platform for', 'smoothly',
    'automate', 'faster', 'easier', 'simplifies', 'empowers', 'enables',
    'modern', 'eliminates', 'reduces', 'approvals', 'billing', 'marketplace',
  ];
  const hasValueProp = valueKeywords.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );

  const presentAttributes = [];
  const missingAttributes = [];

  if (hasTargetAudience) presentAttributes.push('target_audience');
  else missingAttributes.push('target_audience');

  if (hasCoreAction) presentAttributes.push('core_action');
  else missingAttributes.push('core_action');

  if (hasValueProp) presentAttributes.push('value_proposition');
  else missingAttributes.push('value_proposition');

  const sufficient = presentAttributes.length >= 2 && wordCount >= 20;

  let followUpQuestion = null;
  if (!sufficient) {
    if (wordCount < 10) {
      followUpQuestion =
        "That sounds exciting! Could you share a bit more detail about who will be using it and what primary task or workflow they'll be doing in the app?";
    } else if (!hasTargetAudience) {
      followUpQuestion =
        'Great start! Who is your primary target audience or ideal user for this product?';
    } else if (!hasCoreAction) {
      followUpQuestion =
        'Awesome! What is the single most important action or workflow users will perform once they log in?';
    } else {
      followUpQuestion =
        'Tell me a little more about what problem this solves for them and what makes it special or different.';
    }
  }

  return {
    sufficient,
    wordCount,
    presentAttributes,
    missingAttributes,
    followUpQuestion,
  };
}

/**
 * Extracts a 7-dimensional Trait Matrix from user text or pasted PRD.
 *
 * @param {string} text - Raw conversational text or PRD markdown.
 * @returns {Record<string, any>} 7-dimensional Trait Matrix
 */
export function extractStructuredTraits(text = '') {
  const content = String(text || '');
  const lower = content.toLowerCase();

  // 1. Identity & Problem Space
  const identitySection = content.match(/##?\s*.*(?:overview|identity|about|product|vision|summary)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const identityText = identitySection ? identitySection[1].trim() : content;
  const identityWords = identityText.split(/\s+/).filter(Boolean).length;
  const hasIdentityKeywords = /streamline|solves|platform|collaboration|tracking|marketplace|saas|tool/i.test(identityText);
  const identityScore = (identityWords >= 25 && hasIdentityKeywords) || identitySection ? 0.9 : identityWords >= 15 ? 0.5 : 0.2;

  // 2. Actors & Permissions
  const actorsSection = content.match(/##?\s*.*(?:actors|roles|permissions|personas|users|rbac)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const rolesFound = new Set();
  const knownRoles = ['admin', 'member', 'client', 'user', 'customer', 'owner', 'manager', 'editor', 'visitor', 'guest'];
  for (const r of knownRoles) {
    if (new RegExp(`\\b${r}\\b`, 'i').test(content)) {
      rolesFound.add(r);
    }
  }
  const rolesArray = Array.from(rolesFound);
  let actorsScore = 0;
  if (actorsSection && rolesArray.length >= 2) {
    actorsScore = 0.95;
  } else if (rolesArray.length >= 2) {
    actorsScore = 0.8;
  } else if (rolesArray.length === 1) {
    actorsScore = 0.4;
  } else {
    actorsScore = 0.1;
  }

  // 3. Domain Entities & Invariants
  const entitiesSection = content.match(/##?\s*.*(?:entities|domain|data model|database|models|invariants|schemas)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const entitiesFound = [];
  const invariantsFound = [];

  // Match bullet points like - Organization: or - Task:
  const entityBullets = content.match(/^[ \t]*[-*]\s+([A-Z][a-zA-Z0-9]+)\s*:/gm);
  if (entityBullets) {
    for (const b of entityBullets) {
      const match = b.match(/[-*]\s+([A-Z][a-zA-Z0-9]+)\s*:/);
      if (match && match[1]) {
        entitiesFound.push(match[1]);
      }
    }
  }

  // Match invariants
  const invariantMatches = content.match(/.*(?:cannot|must not|never|strictly|immutable|invariant).*/gi);
  if (invariantMatches) {
    invariantsFound.push(...invariantMatches.map((m) => m.trim().replace(/^[-*]\s*/, '')));
  }

  let domainScore = 0;
  if (entitiesFound.length >= 3 && (entitiesSection || invariantsFound.length > 0)) {
    domainScore = 0.9;
  } else if (entitiesFound.length >= 2) {
    domainScore = 0.6;
  } else if (entitiesSection) {
    domainScore = 0.5;
  } else {
    domainScore = 0.15;
  }

  // 4. Security Posture & Isolation
  const securitySection = content.match(/##?\s*.*(?:security|privacy|isolation|compliance)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const rls = /rls|row-level security|row level security/i.test(content);
  const multiTenant = /multi-tenant|tenancy|tenant isolation/i.test(content);
  const compliance = [];
  if (/gdpr/i.test(content)) compliance.push('GDPR');
  if (/hipaa/i.test(content)) compliance.push('HIPAA');
  if (/soc2|soc 2/i.test(content)) compliance.push('SOC2');
  const auditLogging = /audit log|audit-log|audit logging/i.test(content);

  let securityScore = 0;
  if (rls && (multiTenant || compliance.length > 0 || auditLogging)) {
    securityScore = 0.95;
  } else if (rls || multiTenant || securitySection) {
    securityScore = 0.8;
  } else if (compliance.length > 0 || auditLogging) {
    securityScore = 0.5;
  } else {
    securityScore = 0.1;
  }

  // 5. Integrations & Third-Party Services
  const integrationSection = content.match(/##?\s*.*(?:integrations|third-party|services|apis)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const knownServices = ['stripe', 'resend', 'sendgrid', 'slack', 'github', 'supabase', 'cloudflare', 'openai', 'anthropic', 'posthog', 'sentry', 'aws', 'twilio'];
  const servicesFound = [];
  for (const s of knownServices) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(content)) {
      servicesFound.push(s);
    }
  }

  let integrationsScore = 0;
  if (servicesFound.length >= 2 || (integrationSection && servicesFound.length >= 1)) {
    integrationsScore = 0.9;
  } else if (servicesFound.length === 1) {
    integrationsScore = 0.5;
  } else {
    integrationsScore = 0.1;
  }

  // 6. Brand Preferences
  const brandSection = content.match(/##?\s*.*(?:brand|branding|design|visual|colors|tone)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const toneMatches = content.match(/tone:\s*([^.\n]+)/i);
  const colorMatches = content.match(/color(?:s)?:\s*([^.\n]+)/i);
  let brandScore = 0;
  if (brandSection || (toneMatches && colorMatches)) {
    brandScore = 0.85;
  } else if (toneMatches || colorMatches) {
    brandScore = 0.45;
  } else {
    brandScore = 0.1;
  }

  // 7. Stack Preferences
  const stackSection = content.match(/##?\s*.*(?:stack|tech|architecture|technology)[^\n]*\n([\s\S]*?)(?=\n##?|\n#|$)/i);
  const stackKeywords = ['react router', 'nextjs', 'next.js', 'remix', 'supabase', 'postgres', 'postgresql', 'cloudflare', 'prisma', 'tailwind'];
  const stackMatches = stackKeywords.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(content));
  let stackScore = 0;
  if (stackSection && stackMatches.length >= 2) {
    stackScore = 0.9;
  } else if (stackMatches.length >= 2) {
    stackScore = 0.8;
  } else if (stackMatches.length === 1) {
    stackScore = 0.4;
  } else {
    stackScore = 0.1;
  }

  return {
    identity: {
      text: identityText,
      score: identityScore,
    },
    actors_roles: {
      roles: rolesArray,
      score: actorsScore,
    },
    domain_entities: {
      entities: entitiesFound,
      invariants: invariantsFound,
      score: domainScore,
    },
    security_posture: {
      rls,
      multiTenant,
      compliance,
      auditLogging,
      score: securityScore,
    },
    integrations: {
      services: servicesFound,
      score: integrationsScore,
    },
    brand_preferences: {
      tone: toneMatches ? toneMatches[1].trim() : null,
      colors: colorMatches ? colorMatches[1].trim() : null,
      score: brandScore,
    },
    stack_preferences: {
      matches: stackMatches,
      score: stackScore,
    },
  };
}

/**
 * Evaluates whether a pipeline gate can be auto-resolved, needs targeted clarifying,
 * or remains unresolved based on the 7-dimensional Trait Matrix.
 *
 * @param {Record<string, any>} traitMatrix
 * @param {string} gateId
 * @returns {{ resolved: boolean, confidence: number, status: 'resolved' | 'partial' | 'unresolved', confirmation: string | null, clarifyingQuestion: string | null, gateQuestion: string | null }}
 */
export function evaluateGateResolution(traitMatrix = {}, gateId = '') {
  let confidence = 0;
  let confirmation = null;
  let clarifyingQuestion = null;
  let gateQuestion = null;

  switch (gateId) {
    case 'gate_1_problem_space': {
      confidence = traitMatrix.identity?.score ?? 0;
      confirmation = '✅ Extracted problem space and product identity from your PRD. Skipping Step 1!';
      clarifyingQuestion = "I understand what you're building, but could you clarify the primary trigger moment that makes someone use this?";
      gateQuestion = 'What is the core problem this project solves, and who is it for?';
      break;
    }
    case 'gate_2_actors_rbac': {
      confidence = traitMatrix.actors_roles?.score ?? 0;
      confirmation = '✅ Extracted user roles and permissions from your PRD. Skipping Step 2!';
      clarifyingQuestion = 'We identified user roles, but what specific permissions or admin capabilities do you need?';
      gateQuestion = 'Who are the different types of users in your app, and what permissions should each have?';
      break;
    }
    case 'gate_3_entity_modeling': {
      confidence = traitMatrix.domain_entities?.score ?? 0;
      confirmation = '✅ Extracted domain entities and key business rules from your PRD. Skipping Step 3!';
      clarifyingQuestion = 'We mapped your main entities, but are there any strict rules (e.g. items that can never be deleted)?';
      gateQuestion = 'What are the main items or records your app stores, and how do they connect to each other?';
      break;
    }
    case 'gate_4_tenant_security': {
      confidence = traitMatrix.security_posture?.score ?? 0;
      confirmation = '✅ Extracted security posture and tenant isolation from your PRD. Skipping Step 4!';
      clarifyingQuestion = 'Do you have specific compliance requirements (like GDPR) or audit log needs?';
      gateQuestion = 'How private should user data be, and do you need specific security or compliance protections?';
      break;
    }
    case 'step_5_branding': {
      const hasFixedColor =
        Boolean(traitMatrix.brand_preferences?.colors?.primary) ||
        Boolean(traitMatrix.colors?.primary) ||
        (typeof traitMatrix.brand_preferences?.colors === 'string' &&
          traitMatrix.brand_preferences.colors.length > 0 &&
          traitMatrix.brand_preferences.colors !== 'null');
      confidence = hasFixedColor
        ? Math.max(traitMatrix.brand_preferences?.score ?? 0, 0.9)
        : (traitMatrix.brand_preferences?.score ?? 0);
      confirmation = '✅ Extracted fixed brand colors from your PRD. Skipping Step 5!';
      clarifyingQuestion = 'Do you have preferred brand colors or a particular aesthetic in mind?';
      gateQuestion = 'Have you decided on a brand name and visual style?';
      break;
    }
    case 'step_6_stack_archetype': {
      confidence = traitMatrix.stack_preferences?.score ?? 0;
      confirmation = '✅ Extracted stack preferences from your PRD. Skipping Step 6!';
      clarifyingQuestion = 'Do you prefer our flagship full-stack template or another runtime?';
      gateQuestion = 'Confirming your preferred tech stack and database setup.';
      break;
    }
    case 'step_7_research': {
      confidence = traitMatrix.integrations?.services?.length ? 0.85 : 0;
      confirmation = '✅ Extracted declared integrations for research scoping. Skipping Step 7!';
      clarifyingQuestion = 'Which third-party services require pre-scaffold research?';
      gateQuestion = 'Would you like to research third-party service integrations before scaffolding?';
      break;
    }
    default: {
      confidence = 0;
      gateQuestion = `Proceeding with ${gateId}.`;
      break;
    }
  }

  const resolved = confidence >= 0.8;
  const status = resolved ? 'resolved' : confidence >= 0.3 ? 'partial' : 'unresolved';

  return {
    resolved,
    confidence,
    status,
    confirmation: resolved ? confirmation : null,
    clarifyingQuestion: status === 'partial' ? clarifyingQuestion : null,
    gateQuestion: status === 'unresolved' ? gateQuestion : null,
    ...(gateId === 'step_5_branding' && resolved ? { palette_picker: 'skipped_due_to_preexisting_brand' } : {}),
  };
}
