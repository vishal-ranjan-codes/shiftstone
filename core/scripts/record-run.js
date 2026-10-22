#!/usr/bin/env node
/**
 * Workflow run logger (task 5.1) — appends exactly one row to
 * .loops/<workflow-id>/runs.jsonl at workflow end (never per-tool-call,
 * blueprint §9.3).
 *
 *   node core/scripts/record-run.js <workflow-id> --state <terminal-state> --reason "<outcome>"
 *     [--tokens <n>] [--dollars <n>] [--accepted <n>] [--attempts <n>]
 *     [--archetype <pack-id>] [--run-id <id>]
 *
 * States: success | no_op | blocked | stalled | exhausted | error
 * Omit --tokens/--dollars when they cannot be estimated (0 is recorded).
 * Opt out: {"cost-tracker": {"enabled": false}} in core/context/cost-tracker.json.
 */

import { randomUUID } from 'node:crypto';
import { CostTracker } from '../observability/cost-tracker.ts';

const STATES = new Set(['success', 'no_op', 'blocked', 'stalled', 'exhausted', 'error']);

function usage(message) {
  console.error(message);
  console.error(
    'usage: node core/scripts/record-run.js <workflow-id> --state <success|no_op|blocked|stalled|exhausted|error> ' +
      '--reason "<one-line outcome>" [--tokens n] [--dollars n] [--accepted n] [--attempts n] [--archetype id] [--run-id id]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const [id, ...rest] = argv;
  if (!id || id.startsWith('--')) usage('error: missing <workflow-id>');
  const args = { id, tokens: 0, dollars: 0, accepted: 0, attempts: 1 };
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (!flag.startsWith('--') || value === undefined || value.startsWith('--')) {
      usage(`error: ${flag} requires a value`);
    }
    i += 1;
    switch (flag) {
      case '--state':
        if (!STATES.has(value)) usage(`error: --state must be one of ${[...STATES].join('|')}`);
        args.state = value;
        break;
      case '--reason':
        args.reason = value;
        break;
      case '--tokens':
        args.tokens = Number(value);
        break;
      case '--dollars':
        args.dollars = Number(value);
        break;
      case '--accepted':
        args.accepted = Number(value);
        break;
      case '--attempts':
        args.attempts = Number(value);
        break;
      case '--archetype':
        args.archetype = value;
        break;
      case '--run-id':
        args.runId = value;
        break;
      default:
        usage(`error: unknown flag ${flag}`);
    }
  }
  if (!args.state) usage('error: --state is required');
  if (!args.reason) usage('error: --reason is required');
  for (const key of ['tokens', 'dollars', 'accepted', 'attempts']) {
    if (!Number.isFinite(args[key]) || args[key] < 0) usage(`error: --${key} must be a non-negative number`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const tracker = new CostTracker(args.id);
const now = new Date().toISOString();

const row = await tracker.record({
  terminal_state: args.state,
  reason: args.reason,
  archetype: args.archetype,
  state: {
    loop: args.id,
    run_id: args.runId ?? `wf-${randomUUID()}`,
    attempt: args.attempts,
    success_streak: args.state === 'success' ? 1 : 0,
    tokens_used: args.tokens,
    dollars_used: args.dollars,
    started_at: now,
    updated_at: now,
    yardstick: 0,
    last_yardstick_delta: 0,
    barren_turns: 0,
    addressed: [],
    waived: [],
    accepted_changes: args.accepted,
    red_green: { required: false, proven: false, baseline: 'unknown', current: 'unknown' },
    notes: [],
    scratch: {},
    terminal: args.state,
  },
});

const written = await tracker.enabled();
console.log(
  written
    ? `recorded ${args.id} → ${tracker.file} (${args.state}, CAC ${row.cost_per_accepted_change_usd ?? 'null'})`
    : `cost tracking disabled — row computed but not written (${args.state})`,
);
