---
type: chapter-topic
title: "Operational Envelope & Edge Constraints"
chapter: "01-architecture"
file: "operational-envelope.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "SLA targets, 128MB worker memory limits, cold-start tolerances, and payload streaming constraints."
---

# Architecture — Operational Envelope & Edge Constraints

## 1. Edge Execution & Memory Ceiling

Cloudflare Workers operate with a strict **128MB memory ceiling**:
- **Never buffer full response bodies** in memory (`await response.text()` or `await response.arrayBuffer()`).
- **Stream large payloads** using web standard `ReadableStream`.
- Direct large file uploads (> 10MB) to Cloudflare R2 using presigned URLs rather than routing binary streams through the Worker.

## 2. Latency & Concurrency Envelope

- **Cold Starts**: Target < 10ms worldwide via V8 isolate instantiation.
- **P95 Latency**: Target < 150ms for authenticated SSR views; < 50ms for cached edge resource routes.
- **Database Connection Pooling**: Utilize Supabase Transaction Pooler (port 6543) via PgBouncer for serverless concurrency scaling.
- **Subrequest Limits**: Cloudflare limits outgoing subrequests to 50 per invocation on free plans and 1000 on paid plans. Batch database queries to stay well within limits.
