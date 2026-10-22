---
type: decision
decisionId: DEC-006
title: Cloudflare R2 Object Storage via S3-Compatible API
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-006 — Cloudflare R2 Object Storage via S3-Compatible API

## Context
Need scalable file storage without egress fees.

## Decision
Utilize Cloudflare R2 interfaced via the AWS SDK S3 client (`@aws-sdk/client-s3`) using presigned upload/download URLs.

## Consequences
Zero egress fees, high performance, and standard S3 API compatibility.
