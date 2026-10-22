/**
 * OpenTelemetry-Compatible Tracer & Provenance Engine (UG-27 / Phase 7 Unit U28)
 *
 * Implements:
 *   1. Zero-dependency OTel-compatible tracing (spans, events, traceparent context).
 *   2. Step-by-step provenance collection conforming to trajectory/v1 schema.
 *   3. Aggregated execution telemetry bridging to flywheel.jsonl conforming to telemetry/v1.
 */

import { randomUUID } from 'node:crypto';

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags?: number;
}

export interface TraceEvent {
  name: string;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: TraceEvent[];
}

export interface TrajectoryStep {
  stepIndex: number;
  toolName: string;
  targetPath?: string | null;
  verificationLevel?: string | number;
  outcome: 'passed' | 'failed' | 'blocked' | 'skipped' | 'no_op';
  tokensUsed: number;
  durationMs?: number;
  notes?: string;
}

export interface TrajectoryRecord {
  schemaVersion: 'trajectory/v1';
  runId: string;
  trialId: string;
  stageId?: string;
  pack?: string;
  timestamp: string;
  verificationLevel: string | number;
  tokensUsed: number;
  durationMs?: number;
  terminalState: 'success' | 'no_op' | 'blocked' | 'stalled' | 'exhausted' | 'failed';
  status?: 'passed' | 'failed' | 'blocked';
  steps: TrajectoryStep[];
  metadata?: Record<string, unknown>;
}

export interface TelemetryRecord {
  schemaVersion: 'telemetry/v1';
  timestamp: string;
  runId: string;
  trialId?: string;
  pack: string;
  loopPattern: string;
  iterations: number;
  terminalState: 'success' | 'no_op' | 'blocked' | 'stalled' | 'exhausted' | 'failed';
  brakeTriggered: boolean | string | null;
  checkerNormalizedScore?: number | null;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export class Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startTime: number;
  endTime?: number;
  durationMs?: number;
  status: SpanStatus = { code: 'UNSET' };
  attributes: Record<string, unknown> = {};
  events: TraceEvent[] = [];

  constructor(name: string, context?: { traceId?: string; parentSpanId?: string }) {
    this.name = name;
    this.traceId = context?.traceId ?? randomUUID().replace(/-/g, '');
    this.spanId = randomUUID().replace(/-/g, '').slice(0, 16);
    this.parentSpanId = context?.parentSpanId;
    this.startTime = Date.now();
  }

  setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this.attributes, attrs);
    return this;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.events.push({
      name,
      timestamp: new Date().toISOString(),
      attributes,
    });
    return this;
  }

  setStatus(code: SpanStatusCode, message?: string): this {
    this.status = { code, message };
    return this;
  }

  end(): SpanData {
    if (!this.endTime) {
      this.endTime = Date.now();
      this.durationMs = this.endTime - this.startTime;
    }
    return this.toData();
  }

  toData(): SpanData {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.durationMs ?? (Date.now() - this.startTime),
      status: this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
    };
  }
}

export class Tracer {
  readonly name: string;
  private spans: Span[] = [];

  constructor(name = 'default-tracer') {
    this.name = name;
  }

  startSpan(name: string, options?: { parent?: Span | SpanContext; attributes?: Record<string, unknown> }): Span {
    let traceId: string | undefined;
    let parentSpanId: string | undefined;

    if (options?.parent) {
      if ('spanId' in options.parent) {
        traceId = options.parent.traceId;
        parentSpanId = options.parent.spanId;
      }
    }

    const span = new Span(name, { traceId, parentSpanId });
    if (options?.attributes) {
      span.setAttributes(options.attributes);
    }
    this.spans.push(span);
    return span;
  }

  getSpans(): SpanData[] {
    return this.spans.map((s) => s.toData());
  }

  clear(): void {
    this.spans = [];
  }

  /**
   * Synthesizes captured spans into a structured trajectory/v1 record.
   */
  toTrajectoryRecord(options: {
    runId: string;
    trialId: string;
    stageId?: string;
    pack?: string;
    verificationLevel?: string | number;
    terminalState?: 'success' | 'no_op' | 'blocked' | 'stalled' | 'exhausted' | 'failed';
    status?: 'passed' | 'failed' | 'blocked';
  }): TrajectoryRecord {
    const spans = this.getSpans();
    let totalTokens = 0;
    let durationMs = 0;

    const steps: TrajectoryStep[] = spans.map((s, index) => {
      const tokens = typeof s.attributes.tokensUsed === 'number' ? s.attributes.tokensUsed : 0;
      totalTokens += tokens;
      durationMs += s.durationMs ?? 0;

      let outcome: TrajectoryStep['outcome'] = 'passed';
      if (s.status.code === 'ERROR') {
        outcome = 'failed';
      } else if (s.attributes.outcome && typeof s.attributes.outcome === 'string') {
        outcome = s.attributes.outcome as TrajectoryStep['outcome'];
      }

      return {
        stepIndex: index,
        toolName: (s.attributes.toolName as string) ?? s.name,
        targetPath: (s.attributes.targetPath as string) ?? null,
        verificationLevel: (s.attributes.verificationLevel as string | number) ?? options.verificationLevel ?? 2,
        outcome,
        tokensUsed: tokens,
        durationMs: s.durationMs,
        notes: s.status.message ?? (s.attributes.notes as string),
      };
    });

    const terminalState =
      options.terminalState ??
      (steps.some((st) => st.outcome === 'failed') ? 'failed' : 'success');

    return {
      schemaVersion: 'trajectory/v1',
      runId: options.runId,
      trialId: options.trialId,
      stageId: options.stageId,
      pack: options.pack,
      timestamp: new Date().toISOString(),
      verificationLevel: options.verificationLevel ?? 2,
      tokensUsed: totalTokens,
      durationMs,
      terminalState,
      status: options.status ?? (terminalState === 'success' || terminalState === 'no_op' ? 'passed' : 'failed'),
      steps,
    };
  }

  /**
   * Synthesizes captured spans and loop results into a telemetry/v1 record.
   */
  toTelemetryRecord(options: {
    runId: string;
    trialId?: string;
    pack: string;
    loopPattern: string;
    iterations?: number;
    terminalState: 'success' | 'no_op' | 'blocked' | 'stalled' | 'exhausted' | 'failed';
    brakeTriggered?: boolean | string | null;
    checkerNormalizedScore?: number | null;
    costUsd?: number;
    tokensUsed?: number;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): TelemetryRecord {
    const spans = this.getSpans();
    const spanTokens = spans.reduce((sum, s) => sum + (typeof s.attributes.tokensUsed === 'number' ? s.attributes.tokensUsed : 0), 0);
    const spanDuration = spans.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

    const totalTokens = options.tokensUsed ?? spanTokens;
    const durationMs = options.durationMs ?? spanDuration;
    // Default estimated cost: $0.000003 per token if not explicitly provided
    const costUsd = options.costUsd ?? Number((totalTokens * 0.000003).toFixed(6));

    return {
      schemaVersion: 'telemetry/v1',
      timestamp: new Date().toISOString(),
      runId: options.runId,
      trialId: options.trialId,
      pack: options.pack,
      loopPattern: options.loopPattern,
      iterations: options.iterations ?? Math.max(1, spans.length),
      terminalState: options.terminalState,
      brakeTriggered: options.brakeTriggered ?? null,
      checkerNormalizedScore: options.checkerNormalizedScore ?? null,
      totalTokens,
      costUsd,
      durationMs,
      metadata: options.metadata,
    };
  }
}
